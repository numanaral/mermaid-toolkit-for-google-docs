module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("site/assets");
  eleventyConfig.addPassthroughCopy("site/robots.txt");
  eleventyConfig.addPassthroughCopy({ "site/favicon.ico": "favicon.ico" });

  eleventyConfig.addGlobalData("env", process.env.NODE_ENV || "development");

  eleventyConfig.addFilter("toISODate", (date) => {
    return date instanceof Date ? date.toISOString().split("T")[0] : "";
  });

  eleventyConfig.addCollection("sitemapValidated", (collectionApi) => {
    const all = collectionApi.getAll();
    const missing = all
      .filter((item) => !item.data.eleventyExcludeFromCollections && !item.data.sitemapPriority)
      .map((item) => item.inputPath);

    if (missing.length) {
      throw new Error(
        `Missing sitemapPriority in front matter:\n  ${missing.join("\n  ")}`,
      );
    }

    return all;
  });

  return {
    dir: {
      input: "site",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
  };
};
