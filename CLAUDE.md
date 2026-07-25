# Reporting deploys

Only tell the user that new changes are live once the `smoke` job in
`.github/workflows/ci.yml` has run and passed for that deploy. Do not
report a deploy as live based on `deploy` job success alone.
