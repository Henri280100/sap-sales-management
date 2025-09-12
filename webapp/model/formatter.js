sap.ui.define([], function () {
  "use strict";
  return {
    formatCustomerInfo: function (name, id) {
      return name + " - " + id;
    },

    formatAddress: function (street, building, city, postalCode, country) {
      return `${street} ${building}, ${city} ${postalCode}, ${country}`;
    },
  };
});
