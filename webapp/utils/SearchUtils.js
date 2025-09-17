sap.ui.define(
  [
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
  ],
  function (Filter, FilterOperator, FilterType) {
    "use strict";

    function _trim(s) {
      return (s || "").trim();
    }
    return {
      /**
       * Return which fields to search depending on entity set
       */
      getSearchFieldsForEntitySet: function (sEntitySet, key) {
        switch (sEntitySet) {
          case "/SalesOrderSet":
            return ["SalesOrderID", "CustomerName"];
          case "/BusinessPartnerSet":
            return ["BusinessPartnerID", "CompanyName"];
          case "/ProductSet":
            return ["ProductID", "Name", "Category"];
          default:
            // fallback to the key only, don’t invent “ID” or “Name”
            return key ? [key] : [];
        }
      },

      /**
       * Build an OR filter: field1 contains q OR field2 contains q …
       */
      buildOrContainsFilters: function (aFields, sQuery) {
        var q = _trim(sQuery);
        if (!q || !Array.isArray(aFields) || aFields.length === 0) {
          return [];
        }
        var orFilters = aFields.map(function (path) {
          return new Filter(path, FilterOperator.Contains, q);
        });
        return [new Filter({ and: false, filters: orFilters })];
      },

      /**
       * Apply a Contains search on a binding.
       */
      // SearchUtils.js
      applySearchToBinding: function (oBinding, aFields, sQuery) {
        if (!oBinding) {
          return;
        }
        var a = this.buildOrContainsFilters(aFields, sQuery);
        if (a.length === 0) {
          oBinding.filter([], FilterType.Application); // clear → no $filter
        } else {
          oBinding.filter(a, FilterType.Application);
        }
      },
    };
  }
);
