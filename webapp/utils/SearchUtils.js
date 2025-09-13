sap.ui.define([
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/FilterType"
], function (Filter, FilterOperator, FilterType) {
  "use strict";

  return {
    /**
     * Return which fields to search depending on entity set
     */
    getSearchFieldsForEntitySet: function (sEntitySet, sFallbackKey) {
      switch (sEntitySet) {
        case "/SalesOrderSet":
          return ["SalesOrderID", "CustomerName"];
        case "/BusinessPartnerSet":
          return ["BusinessPartnerID", "CompanyName"];
        case "/ProductSet":
          return ["ProductID", "Name", "Category"];
        default:
          return [sFallbackKey || "ID", "Name"];
      }
    },

    /**
     * Build an OR filter: field1 contains q OR field2 contains q …
     */
    buildOrContainsFilters: function (aFields, sQuery) {
      var q = (sQuery || "").trim();
      if (!q) { return []; }

      var aOr = aFields.map(function (sPath) {
        return new Filter(sPath, FilterOperator.Contains, q);
      });

      return aOr.length ? [new Filter({ filters: aOr, and: false })] : [];
    },

    /**
     * Apply a Contains search on a binding.
     */
    applySearchToBinding: function (oBinding, aFields, sQuery) {
      if (!oBinding) { return; }
      var aFilters = this.buildOrContainsFilters(aFields, sQuery);
      oBinding.filter(aFilters, FilterType.Application);
    }
  };
});
