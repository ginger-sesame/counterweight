# counterweight

Counterweight helps a treasury offer WETH/USDC liquidity while controlling the inventory allocated to its strategy. Assets remain in the maker wallet through Aqua's allocation model. Quotes encourage trades toward a target allocation, and an execution-time guard rejects trades that would exceed immutable exposure limits.

We implement a custom SwapVM router with two custom instructions and a small patch to the pinned SwapVM base contract. It uses Aqua for strategy allocation accounting and actual token settlement. The custom logic combines inventory-seeking quotes with mandatory execution-time exposure checks.
