---
title: Simple Magic Test
---

# Simple Magic Block Test

Testing basic magic block decompression.

```magic
eJxLTEpMSk5JBQALswKT
```

```javascript on:update
term.clear();
term.write(0, 0, "If you see this, magic blocks work!", theme.success);
term.write(0, 2, "Check View Source to see the magic block", theme.dim);
```
