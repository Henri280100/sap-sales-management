sap.ui.define(
  [
    // UI controls used when building the inner table
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Token",
    "sap/ui/table/Column", // desktop table column
  ],
  function (Label, Text, MColumn, ColumnListItem, Token, UITableColumn) {
    "use strict";

    /**
     * Utility helpers for ValueHelpDialog usage across controllers.
     */
    var ValueHelpUtils = {

      

      /**
       * Decide which VHD config to use based on the triggering MultiInput.
       * @param {sap.ui.core.Control} oInput - The MultiInput that opened the dialog.
       * @param {{salesOrderMI?:sap.m.MultiInput,customerNameMI?:sap.m.MultiInput,productMI?:sap.m.MultiInput}} oRefs
       * @returns {object|null}
       */
      resolveConfig: function (oController, oMI) {
        if (oMI === oController.byId("idSalesOrderIDMultiInput")) {
          return {
            title: "Select Sales Order",
            entitySet: "/SalesOrderSet",
            columns: [
              { name: "SalesOrderID", label: "Sales Order ID" },
              { name: "CustomerName", label: "Customer Name" },
              { name: "GrossAmount", label: "Gross Amount" },
              { name: "BillingStatusDescription", label: "Billing Status" },
              { name: "DeliveryStatusDescription", label: "Delivery Status" },
            ],
            key: "SalesOrderID",
          };
        } else if (oMI === oController.byId("idCustomerNameMultiInput")) {
          return {
            title: "Select Customer",
            entitySet: "/BusinessPartnerSet",
            columns: [
              { name: "BusinessPartnerID", label: "Customer ID" },
              { name: "CompanyName", label: "Company Name" },
            ],
            key: "BusinessPartnerID",
          };
        } else if (oMI === oController.byId("idProductIDMultiInput")) {
          return {
            title: "Select Product",
            entitySet: "/ProductSet",
            columns: [
              { name: "ProductID", label: "Product ID" },
              { name: "Name", label: "Product Name" },
              { name: "Category", label: "Category" },
            ],
            key: "ProductID",
          };
        }
        return null;
      },

      /**
       * Configure and bind the ValueHelpDialog before each open.
       */
      configureVHD: function (oVHD, config, oModel, aTokens) {
        if (!oVHD || !config) {
          return;
        }

        oVHD.setTitle(config.title);
        oVHD.setKey(config.key);
        oVHD.setDescriptionKey(config.key);

        oVHD.getTableAsync().then(function (oTable) {
          oTable.setModel(oModel);

          // Build columns only once
          if (oTable.getColumns && oTable.getColumns().length === 0) {
            if (oTable.bindRows) {
              // Desktop sap.ui.table.Table
              config.columns.forEach(function (col) {
                oTable.addColumn(
                  new UITableColumn({
                    label: new Label({ text: col.label }),
                    template: new Text({ text: `{${col.name}}` }),
                  })
                );
              });
            } else if (oTable.bindItems) {
              // Mobile sap.m.Table
              config.columns.forEach(function (col) {
                oTable.addColumn(
                  new MColumn({
                    header: new Label({ text: col.label }),
                  })
                );
              });
            }
          }

          // Rebind rows/items to refresh each open
          if (oTable.bindRows) {
            oTable.bindRows(config.entitySet);
          } else if (oTable.bindItems) {
            oTable.bindItems({
              path: config.entitySet,
              template: new ColumnListItem({
                cells: config.columns.map(function (col) {
                  return new Label({ text: `{${col.name}}` });
                }),
              }),
            });
          }

          oVHD.update();
        });

        // Apply tokens from the triggering MultiInput
        if (aTokens && aTokens.length) {
          oVHD.setTokens(aTokens);
        }
      },
      
    };

    return ValueHelpUtils;
  }
);
