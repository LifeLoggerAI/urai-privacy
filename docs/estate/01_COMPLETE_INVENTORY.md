# Exact-snapshot inventory and byte accountability

**Verified snapshot:** 2026-11-07. Privacy main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317; review #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All claims in this pack are SOURCE-REVIEW or explicitly labeled historical test receipts. None authorizes production, private media access, consent issuance, or deployment.

GitHub recursive tree for main: 301 blobs, 72 dirs, 1648233 bytes, truncated=false, tree 1163d6f32a123ef9a6638e092a3eee5ec4a3b317. R841: 373 blobs, 74 dirs, 2162240 bytes, truncated=false, tree 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All 674 snapshot path entries, sizes and blob SHA-1 identities are in MANIFEST.json. A duplicate file on two snapshots is not a separately read content sample.

R841 compared to main: 72 added paths; zero removed; 30 existing paths have new Git blob SHAs; 271 unchanged paths. GitHub compare reports R841 304 commits ahead, 0 behind main; this is revision lineage, not proof every intermediate object was read. Branch-search enumeration observed 198 branch-name entries across returned pages; full branch contents and tags were NOT audited. Pulls API returned 210 PR records over three pages, not 210 individually read diffs. No submodule entries in these two Git trees. LFS presence/remote objects and historical deleted binaries remain unverified.

## Coverage method
'Git blob SHA-1' and byte size are authoritative provider Git metadata, **not** independent SHA256 of raw content. All paths = tree-inventoried only. Semantic reads are a limited source subset documented in 03-05. Two R841 original source files were reconstructed byte-exact and independently SHA256 hashed: host preflight blob 9387a329f53e7d67f57a1417f813069e896e6b85 / sha256 74d7f5aaa0671e834148f6f21de38cdf2a54e8cdb60193c80160b844c33ba6f1; its test blob 39a525dafa49f021cfbb72d23c455915536ce1e3 / sha256 9fe6d7a9a0f9ff26d941ddf9a1bb385fb3300c8575ecf93d386738be085573a7. TAP stdout sha256 4ec681dcd507552742f8ced97ba39326fdcc5f2e0fba8d85f3f5acddf541e14c.

## Significant source partitions
R841 top levels: app (26 tracked files), functions (41), tests (56), docs (56), scripts (49), .github (20), policy (5), legal (8), architecture (7), launch-proof (7), adoption (12), website (17), src (7). See manifest for exact paths; this is a path-count inventory, not whole-document reading.

## External/out-of-tree exclusions
Full Git pack/history objects, unreachable refs, archived workflow artifacts, LFS bytes, remote GCP/Firebase rules actually deployed, actual GCS IAM policies, private user media, signed consent records, live token status, runtime-generated outputs, private Drive/Gmail files, physical devices and other accounts are not included. No coverage percentage is assigned to these unknown universes.
