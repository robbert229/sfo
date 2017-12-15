#!/usr/bin/env node
const DevServer = require("webpack-dev-server");
const webpack = require("webpack");
const path = require("path");
const _ = require("lodash");
const fs = require("fs");
const tmp = require("tmp");
const meow = require("meow");
const chalk = require("chalk");
const portfinder = require("portfinder");

const errLog = msg => console.log(chalk.red(msg));

const cli = meow(
  `
  Usage
    $ sfo <entry input>

  Commands
    <no command>, dev   start a dev server
    bundle              prepare an artifact for deployment
    size                visualize the size of your app
    integrate           symlink linting configs into your project

  Options
    --typescript, -t    use TypeScript instead of Flow
    --no-eslint, -n     don't use the integrated eslint
    --title, -T         title for the name of the home page
`,
  {
    flags: {
      typescript: {
        type: "boolean",
        alias: "t",
        default: false
      },
      "no-eslint": {
        type: "boolean",
        alias: "n",
        default: false
      },
      title: {
        type: "string",
        alias: "T",
        default: "sfo"
      }
    }
  }
);

if (!cli.input.length) {
  cli.showHelp();
}

if (cli.input.length !== 2) {
  errLog("Improper number of arguments");
  process.exit(1);
}

// if (cli.input.length === 2 || cli.input[0] === 'dev') {
//   const inputPath = cli.input.length === 2 ? cli.input[0] : cli.input[1];
//   bundle(inputPath, true);
// }

switch (cli.input[0]) {
  case "dev":
    bundle(cli.input[1], true);
    break;
  case "bundle":
    bundle(cli.input[1], false);
    break;
  case "size":
    bundle(cli.input[1], false, true);
    break;
  case "integrate":
    integrate(cli.input[1]);
    break;
  default:
    errLog(`${cli.input[0]} is not a valid command`);
    process.exit(1);
}

function integrate(inputPath) {
  console.log(chalk.green("Integrating ESLint"));
  const destination = path.resolve(process.cwd(), inputPath, ".eslintrc.json");
  const ourConfig = path.resolve(__dirname, ".eslintrc.json");
  fs.symlink(ourConfig, destination, err => {
    if (err) {
      console.log(chalk.red("symlink error"));
      console.log(chalk.red(err));
      process.exit(1);
    }
    console.log(chalk.green("Success!"));
    process.exit(0);
  });
}

function bundle(inputPath, isDev, isSizeAnalysis) {
  process.env.NODE_ENV = isDev ? "development" : "production";

  const entry = path.resolve(process.cwd(), inputPath);
  const webpackConfigFn = require("./src/webpackConfig");
  const tempDir = path.resolve(process.cwd(), ".tmp");

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const templateString = fs.readFileSync(
    path.resolve(__dirname, "./src/client.js")
  );
  const tempPath = path.resolve(tempDir, "webpackEntry.js");
  const templatedEntry = _.template(templateString)({
    USER_FN: path.relative(tempDir, entry)
  });
  fs.writeFileSync(tempPath, templatedEntry);
  const webpackConfig = webpackConfigFn(tempPath, {
    noEslint: cli["no-eslint"],
    isSizeAnalysis,
    title: cli.flags.title ? cli.flags.title : "sfo"
  });

  const compiler = webpack(webpackConfig);

  if (isDev) {
    const server = new DevServer(compiler, webpackConfig.devServer);

    portfinder.getPort((err, port) => {
      server.listen(port, "127.0.0.1", () => {
        console.log(chalk.green(`Starting server on http://localhost:${port}`));
      });
    });
  } else {
    compiler.run((err, stats) => {
      console.log(
        stats.toString({
          colors: true
        })
      );
    });
  }
}
