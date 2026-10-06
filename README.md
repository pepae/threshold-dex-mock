# Threshold DEX mock

An interactive mock of a perpetual-futures venue that clears **threshold-encrypted orders in frequent batch auctions**: one batch every 100 ms, one uniform price per market, and no order readable before its batch is committed.

Live: https://pepae.github.io/threshold-dex-mock/

Everything runs in the browser on simulated data. There is no backend, no real cryptography and no real funds; ciphertexts are illustrative.

## Views

**Trade** (`#trade`)
- Order ticket: the order is "encrypted" in the browser and targets the next batch; its progress shows commit, key release and the fill at the batch's clearing price.
- Clearing price per batch, aggregated public depth, recent batches.
- What a front-runner sees: same-size ciphertexts only.
- Sniper bots against a market maker: the textbook model from Budish, Cramton and Shim (2015), continuous book versus 100 ms batches.

**Engine room** (`#engine`)
- Keyper ring: four committee nodes sign the batch, the commit certificate goes out, five keypers send their key shares (which also gossip around the ring), and the third share unlocks the batch. Replayed in slow motion with flight times to scale. Click a keyper to stop or restart it.
- Controls: network profile (one region, Europe, global), orders per batch (100, 1,000, 10,000), keypers on or off, and an early-share drill that shows how a premature share becomes verifiable evidence.
- Time per stage for each batch, decryption load and cores needed, nodes by region, the share race, and a batch log.

## Model behind the numbers

These are design estimates for illustration, not measurements.

| Item | Value used |
| --- | --- |
| Batch interval | 100 ms (average wait 50 ms) |
| Committee | 4 nodes, 3 signatures commit a batch |
| Keypers | 5 nodes, 3 shares release the batch key |
| Commit certificate | 2 to 5 ms one region, 20 to 50 ms Europe, 150 to 250 ms global |
| Share delay per keyper | by region; the batch key waits for the third-fastest share, plus 2 ms to combine |
| Decryption | one pairing per order, 0.7 ms per core, 16 cores |
| Clearing | 1 ms plus 1 ms per 1,500 orders |

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Options

- `?name=Your%20Venue` shows a different venue name in the header.
- `#engine` opens the engine room directly.

## Hosting

Static files only. GitHub Pages serves the repository root from the `main` branch (Settings, Pages, Deploy from a branch, `main`, `/ (root)`).

## Background

Threshold encryption as used by [Shutter Network](https://www.shutter.network): orders are encrypted to a key that only a threshold of keypers can release, and they release it only after the batch is fixed. See [rolling-shutter](https://github.com/shutter-network/rolling-shutter) for the keyper implementation.
