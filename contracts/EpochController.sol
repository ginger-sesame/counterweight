// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {StrategyTypes as S} from "./libraries/StrategyTypes.sol";
import {InventoryGuard as Guard} from "./libraries/InventoryGuard.sol";
import {OrderCodec} from "./libraries/OrderCodec.sol";

/// @notice Immutable safety epoch. Privy later restricts signers sharing the maker wallet.
contract EpochController {
    S.Config private _config;
    IAqua public immutable aqua;
    address public immutable router;
    bytes32 public immutable orderHash;
    bytes32 public immutable safetyDigest;
    uint64 public tuningVersion = 1;
    bool public paused = true;
    uint40 public tuningValidUntil;
    S.Tuning private _tuning;
    error Unauthorized();
    error Paused();
    error VersionMismatch();
    error InvalidTuning();
    error InvalidDeadline();
    event TuningChanged(uint64 version, uint16 intensityBps, uint16 spreadBps, uint40 validUntil);
    event PauseChanged(bool paused, uint64 version);

    constructor(S.Config memory c, address aqua_, address router_) {
        Guard.validateConfig(c);
        if (aqua_.code.length == 0 || router_ == address(0)) revert S.InvalidConfig();
        _config = c;
        aqua = IAqua(aqua_);
        router = router_;
        orderHash = keccak256(abi.encode(OrderCodec.order(c.owner, c.epochId)));
        safetyDigest = keccak256(abi.encode(c, aqua_, router_, orderHash));
    }
    modifier onlyOwner() {
        if (msg.sender != _config.owner) revert Unauthorized();
        _;
    }

    function config() external view returns (S.Config memory) {
        return _config;
    }

    function requireActive() public view {
        if (paused) revert Paused();
        if (block.timestamp < _config.start || block.timestamp > _config.end) revert S.EpochInactive();
    }

    function effectiveTuning() external view returns (S.Tuning memory) {
        if (!_tuning.available || block.timestamp > tuningValidUntil) return S.Tuning(false, 0, 100);
        return _tuning;
    }

    function setTuning(uint16 intensityBps, uint16 spreadBps, uint64 expectedVersion, uint40 validUntil)
        external
        onlyOwner
    {
        requireActive();
        if (expectedVersion != tuningVersion) revert VersionMismatch();
        if (intensityBps > 1000 || spreadBps < 10 || spreadBps > 100) revert InvalidTuning();
        if (validUntil <= block.timestamp || validUntil > block.timestamp + 300 || validUntil > _config.end) {
            revert InvalidDeadline();
        }
        _tuning = S.Tuning(true, intensityBps, spreadBps);
        tuningValidUntil = validUntil;
        tuningVersion++;
        emit TuningChanged(tuningVersion, intensityBps, spreadBps, validUntil);
    }

    function pause() external onlyOwner {
        paused = true;
        tuningVersion++;
        emit PauseChanged(true, tuningVersion);
    }

    function resume() external onlyOwner {
        if (block.timestamp < _config.start || block.timestamp > _config.end) revert S.EpochInactive();
        (uint256 w, uint256 u) = aqua.safeBalances(_config.owner, router, orderHash, S.WETH, S.USDC);
        Guard.checkBacking(
            S.Inventory(w, u, IERC20(S.WETH).balanceOf(_config.owner), IERC20(S.USDC).balanceOf(_config.owner))
        );
        Guard.checkPost(_config, w, u);
        paused = false;
        tuningVersion++;
        emit PauseChanged(false, tuningVersion);
    }
}
