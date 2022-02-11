const moment = require("moment");

exports.queryToMongoFilter = (query, filter = {}) => {
  for (const [k, v] of Object.entries(query)) {
    if (
      ![
        "search",
        "page",
        "perpage",
        "status",
        "sort",
        "projection",
        "export_by",
      ].includes(k) &&
      !k.startsWith("group__")
    ) {
      let value = v;
      let key = k;
      if (value == "true") {
        value = true;
      } else if (value == "false") {
        value = false;
      }
      const keyoperator = k.split("__");
      if (keyoperator.length > 1) {
        key = keyoperator[0];

        switch (keyoperator[1]) {
          case "in":
            value = {
              [`$${keyoperator[1]}`]: value.split(","),
            };
            break;
          case "between":
            value = {
              ["$lte"]: moment(value.split(",")[1]).isValid
                ? moment(value.split(",")[1])
                : value.split(",")[1],
              ["$gte"]: moment(value.split(",")[0]).isValid
                ? moment(value.split(",")[0])
                : value.split(",")[0],
            };
            break;
          default:
            value = {
              [`$${keyoperator[1]}`]: value,
            };
        }
      }

      filter[key] = value;
    }
  }
  return filter;
};
