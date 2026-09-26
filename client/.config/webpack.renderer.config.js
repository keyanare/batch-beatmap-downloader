/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const rules = require("./webpack.rules");

module.exports = {
  module: {
    rules: [
      ...rules,
      {
        test: /\.css$/,
        use: [
          { loader: "style-loader" },
          { loader: "css-loader", options: { importLoaders: 1 } },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                config: path.join(__dirname, "postcss.config.js"),
              },
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css"],
  },
};
