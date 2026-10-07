# plugins/

Workspace root for your in-house Backstage plugins. Scaffold one with:

```sh
yarn new
```

Plugins created here are workspaces of this repo (see the root
`package.json`), so the frontend and backend can depend on them with
`"your-plugin": "workspace:^"`.

This directory ships with only this README so the Docker build's
`COPY plugins plugins` step and the workspace glob stay valid before your
first plugin exists.
