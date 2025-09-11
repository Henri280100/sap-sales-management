sap.ui.define(
  [
    "sap/f/library",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/ui/model/Sorter",
    "sap/m/Token",
    "sap/m/Label",
    "sap/m/SearchField",
    "sap/m/MessageToast",
    "sap/m/ColumnListItem",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
  ],
  function (
    library,
    Controller,
    Filter,
    FilterOperator,
    FilterType,
    Sorter,
    Token,
    Label,
    SearchField,
    MessageToast,
    ColumnListItem,
    UIColumn,
    Column,
    Text
  ) {
    "use strict";

    return Controller.extend("sap.ui.smt.controller.SaleOrderList", {
      onInit: function () {
        // Keep counts fresh whenever data for the table changes

        this._oMultiInput = {
          salesOrderMI: this.byId("idSalesOrderIDMultiInput"),
          customerNameMI: this.byId("idCustomerNameMultiInput"),
          productMI: this.byId("idProductIDMultiInput"),
        };

        this.oView = this.getView();
        this._bDescendingSort = false;
        this.oSaleOrderTable = this.oView.byId("idSalesOrderSetTable");

        const oModel = this.getOwnerComponent().getModel("salesOrder");
        this.getView().setModel(oModel, "salesOrder");

        var oTable = this.byId("idSalesOrderSetTable");
        this._billingCounts = Object.create(null);

        var attach = function () {
          var oBinding = oTable.getBinding("items");
          if (!oBinding) {
            return;
          }

          // Rebuild counts whenever data arrives or changes
          oBinding.attachDataReceived(this._rebuildBillingCounts, this);
          oBinding.attachChange(this._rebuildBillingCounts, this);

          // Build once immediately (in case data is already there)
          this._rebuildBillingCounts();
        }.bind(this);

        // If binding exists now, attach; else wait for first fill
        if (oTable.getBinding("items")) {
          attach();
        } else {
          oTable.attachEventOnce("updateFinished", attach);
        }

        oModel.metadataLoaded().then(() => {
          console.log("SalesOrder metadata loaded.");
        });
        this.oRouter = this.getOwnerComponent().getRouter();
      },

      // @endregion
      // Internal helper methods
      _getDefaultTokens: function () {
        var aTokens = [];
        var oModel = this.getOwnerComponent().getModel("salesOrder");

        // Example: preload product PD-103
        var oContext = oModel.createKey("/ProductSet", {
          ProductID: "HT-1000",
        });
        oModel.read(oContext, {
          success: function (oData) {
            aTokens.push(
              new sap.m.Token({
                key: oData.ProductID,
                text: oData.Name + " (" + oData.ProductID + ")",
              })
            );
          },
        });

        // Example: preload Sales Order 0500000001
        var oContext2 = oModel.createKey("/SalesOrderSet", {
          SalesOrderID: "0500000001",
        });
        oModel.read(oContext2, {
          success: function (oData) {
            aTokens.push(
              new sap.m.Token({
                key: oData.SalesOrderID,
                text: oData.CustomerName + " (" + oData.SalesOrderID + ")",
              })
            );
          },
        });

        return aTokens;
      },

      onSearchFieldSearch: function (oEvent) {
        var oTableSearchState = [],
          sQuery = oEvent.getParameter("query");
        if (sQuery && sQuery.length > 0) {
          oTableSearchState = [
            new Filter({
              filters: [
                new Filter("SalesOrderID", FilterOperator.Contains, sQuery),
                new Filter("CustomerName", FilterOperator.Contains, sQuery),
              ],
              and: false,
            }),
          ];
        }
        this.oSaleOrderTable
          .getBinding("items")
          .filter(oTableSearchState, "Application");
      },

      onAddOverflowToolbarButtonPress: function (oEvent) {},

      // Sort table
      onSortOverflowToolbarButtonPress: function () {
        this._bDescendingSort = !this._bDescendingSort;
        var oBinding = this.oSaleOrderTable.getBinding("items"),
          oSorter = new Sorter("SalesOrderID", this._bDescendingSort);

        oBinding.sort(oSorter);
      },

      onMultiInputValueHelpRequest: async function (oEvent) {
        this._oBasicSearchField = new SearchField();
        this._currentMI = oEvent.getSource(); // Store the ID of the input that triggered the req

        const oModel = this.getOwnerComponent().getModel("salesOrder");
        if (!oModel) {
          MessageToast.show("SalesOrder model is not available for value help");
          return;
        }

        // Define config based on which input triggered
        let config;
        if (this._currentMI === this._oMultiInput.salesOrderMI) {
          config = {
            title: "Select Sale Order",
            entitySet: "/SalesOrderSet",
            columns: [
              { name: "SalesOrderID", label: "Sales Order ID" },
              { name: "CustomerName", label: "Customer Name" },
              { name: "GrossAmount", label: "Gross Amount" },
              { name: "BillingStatusDescription", label: "Billing Status" },
              { name: "DeliveryStatusDescription", label: "Delivery Status" },
            ],
            key: "SalesOrderID",
            filterField: "SalesOrderID",
            filterLabel: "Sale Order No",
          };
        } else if (this._currentMI === this._oMultiInput.customerNameMI) {
          config = {
            title: "Select Customer",
            entitySet: "/BusinessPartnerSet",
            columns: [
              { name: "BusinessPartnerID", label: "Customer ID" },
              { name: "CompanyName", label: "Company Name" },
            ],
            key: "BusinessPartnerID",
            filterField: "CompanyName",
            filterLabel: "Customer Name",
          };
        } else if (this._currentMI === this._oMultiInput.productMI) {
          config = {
            title: "Select Product",
            entitySet: "/ProductSet",
            columns: [
              { name: "ProductID", label: "Product ID" },
              { name: "Name", label: "Product Name" },
              { name: "Category", label: "Category" },
            ],
            key: "ProductID",
            filterField: "Name",
            filterLabel: "Product Name",
          };
        }

        if (!config) {
          MessageToast.show("Invalid value help request.");
          return;
        }

        this.loadFragment({
          id: this.getView().getId(),
          name: "sap.ui.smt.view.fragment.ValueHelpDialog",
          controller: this,
        }).then(
          function (oValueHelpDialog) {
            var oFilterBar = oValueHelpDialog.getFilterBar(),
              oColumn;

            try {
              this.getView().addDependent(oValueHelpDialog);
              const oModel = this.getOwnerComponent().getModel("salesOrder");
              if (oModel && oModel instanceof sap.ui.model.Model) {
                oValueHelpDialog.setModel(oModel);
              } else {
                MessageToast.show("Model no available or invalid for dialog.");
                return;
              }
            } catch (oError) {
              MessageToast.show(
                "Failed to load value help dialog: " + oError.message
              );
              console.error("Fragment loading error: ", oError);
              return;
            }

            // Ensure dialog is initialized before proceeding
            if (!oValueHelpDialog) {
              MessageToast.show("Value help dialog is not initialized.");
              return;
            }

            // Customize the dialog for the current type
            oValueHelpDialog.setTitle(config.title);
            oValueHelpDialog.setKey(config.key);
            oValueHelpDialog.setDescriptionKey(config.key);

            // Set range key fields for Define Conditions tab
            oValueHelpDialog.setRangeKeyFields([
              {
                label: config.filterLabel,
                key: config.key,
                type: "string",
                typeInstance: new sap.ui.model.type.String(
                  {},
                  { maxLength: 40 }
                ),
              },
            ]);

            // Configure filter bar

            oFilterBar.setFilterBarExpanded(false);
            oFilterBar.setBasicSearch(this._oBasicSearchField);

            // Trigger filter bar search on basic search
            this._oBasicSearchField.attachSearch(function () {
              oFilterBar.search();
            });

            // Bind the dialog's internal table
            oValueHelpDialog.getTableAsync().then(
              function (oTable) {
                oTable.setModel(oModel);

                if (oTable.bindRows) {
                  // For sap.ui.table.Table
                  // bind rows to the data and add columns
                  oTable.bindAggregation("rows", {
                    path: config.entitySet,
                    // parameters: {
                    //   select: config.columns.map((col) => col.name).join(","),
                    // },
                    events: {
                      dataReceived: function (oEvent) {
                        const oData = oEvent.getParameter("data");
                        console.log(
                          "Data received for " + config.entitySet + ":",
                          oData
                        );
                        if (
                          !oData ||
                          !oData.results ||
                          oData.results.length === 0
                        ) {
                          MessageToast.show(
                            "No data received for " + config.entitySet + "."
                          );
                          console.warn(
                            config.entitySet + " data is empty or undefined:",
                            oData
                          );
                        }
                        //oTable.getBinding("rows").refresh(true); // Force refresh
                        oValueHelpDialog.update();
                      },
                    },
                  });
                  // oTable.removeAllColumns();
                  config.columns.forEach(function (col) {
                    oColumn = new UIColumn({
                      label: new Label({ text: col.label }),
                      template: new Text({
                        wrapping: false,
                        text: "{" + col.name + "}",
                      }),
                    });
                    oColumn.data({
                      fieldName: col.name,
                    });
                    oTable.addColumn(oColumn);
                  });
                }
                if (oTable.bindItems) {
                  // For Mobile the default table is sap.m.Table
                  oTable.bindAggregation("items", {
                    path: config.entitySet,
                    // parameters: {
                    //   select: config.columns.map((col) => col.name).join(","),
                    // },
                    template: new ColumnListItem({
                      cells: config.columns.map(function (col) {
                        return new Label({ text: "{" + col.name + "}" });
                      }),
                    }),
                    events: {
                      dataReceived: function (oEvent) {
                        const oData = oEvent.getParameter("data");
                        console.log(
                          "Data received for " + config.entitySet + ":",
                          oData
                        );
                        if (
                          !oData ||
                          !oData.results ||
                          oData.results.length === 0
                        ) {
                          MessageToast.show(
                            "No data received for " + config.entitySet + "."
                          );
                          console.warn(
                            config.entitySet + " data is empty or undefined:",
                            oData
                          );
                        }
                        // oTable.getBinding("rows").refresh(true); // Force refresh
                        oValueHelpDialog.update();
                      },
                    },
                  });
                  // oTable.removeAllColumns();
                  config.columns.forEach(function (col) {
                    oTable.addColumn(
                      new Column({ header: new Label({ text: col.label }) })
                    );
                  });
                  // oTable.getBinding("items").refresh(true); // Initial refresh
                }

                oValueHelpDialog.update();
              }.bind(this)
            );

            // Set initial tokens and open the dialog
            oValueHelpDialog.setTokens(this._currentMI.getTokens());
            oValueHelpDialog.open();
          }.bind(this)
        );
      },

      _applyAllFilters: async function () {
        var oTable = this.byId("idSalesOrderSetTable");
        if (!oTable) {
          console.warn("[_applyAllFilters] Table not found");
          return;
        }

        var oBinding = oTable.getBinding("items");
        if (!oBinding) {
          console.warn("[_applyAllFilters] Table binding not found");
          return;
        }

        var aSOKeys = [];
        var aBPKeys = [];
        var aPRKeys = [];

        if (
          this._oMultiInput &&
          this._oMultiInput.salesOrderMI &&
          this._oMultiInput.salesOrderMI.getTokens
        ) {
          aSOKeys = this._oMultiInput.salesOrderMI
            .getTokens()
            .map(function (t) {
              return t.getKey();
            })
            .filter(function (k) {
              return !!k;
            });
        }

        if (
          this._oMultiInput &&
          this._oMultiInput.customerNameMI &&
          this._oMultiInput.customerNameMI.getTokens
        ) {
          aBPKeys = this._oMultiInput.customerNameMI
            .getTokens()
            .map(function (t) {
              return t.getKey();
            }) // BusinessPartnerID
            .filter(function (k) {
              return !!k;
            });
        }

        if (
          this._oMultiInput &&
          this._oMultiInput.productMI &&
          this._oMultiInput.productMI.getTokens
        ) {
          aPRKeys = this._oMultiInput.productMI
            .getTokens()
            .map(function (t) {
              return t.getKey();
            }) // ProductID
            .filter(function (k) {
              return !!k;
            });
        }

        console.log("[_applyAllFilters] token keys:", {
          salesOrders: aSOKeys,
          customers: aBPKeys,
          products: aPRKeys,
        });

        var aSOFromProducts = [];
        if (aPRKeys.length > 0) {
          var oModel = this.getOwnerComponent().getModel("salesOrder");
          if (!oModel) {
            console.warn(
              "[_applyAllFilters] salesOrder model missing; skipping product resolution."
            );
          } else {
            // OR group: (ProductID eq 'P1') or (ProductID eq 'P2') ...
            var aProductFilters = aPRKeys.map(function (pid) {
              return new Filter("ProductID", FilterOperator.EQ, pid);
            });
            var oProductsOrGroup = new Filter({
              and: false,
              filters: aProductFilters,
            });

            // Read all pages (follow __next) and collect SalesOrderID
            var aCollectedIDs = [];
            var sNextSkipToken = null;

            // Helper to execute one page read
            // var readPage = function (mParams) {
            //   return new Promise(function (resolve, reject) {
            //     oModel.read("/SalesOrderLineItemSet", mParams);
            //     mParams._done = function () {
            //       resolve();
            //     };
            //     mParams._fail = function (e) {
            //       reject(e);
            //     };
            //   });
            // };

            try {
              // First page
              await new Promise(function (resolve, reject) {
                oModel.read("/SalesOrderLineItemSet", {
                  filters: [oProductsOrGroup],
                  urlParameters: { $select: "SalesOrderID" },
                  success: function (oData) {
                    try {
                      var aRes = oData && oData.results ? oData.results : [];
                      aRes.forEach(function (r) {
                        aCollectedIDs.push(r.SalesOrderID);
                      });
                      // __next pagination handling
                      sNextSkipToken =
                        oData && oData.__next ? oData.__next : null;
                      resolve();
                    } catch (e) {
                      reject(e);
                    }
                  },
                  error: function (oErr) {
                    reject(oErr);
                  },
                });
              });

              // Follow __next if present (ES5 may not always paginate, but we support it)
              while (sNextSkipToken) {
                // Extract $skiptoken=... from __next URL
                var sTokenMatch = decodeURIComponent(sNextSkipToken);
                var sSkipToken = "";
                var iIdx = sTokenMatch.indexOf("$skiptoken=");
                if (iIdx >= 0) {
                  sSkipToken = sTokenMatch.substring(
                    iIdx + "$skiptoken=".length
                  );
                }

                await new Promise(function (resolve, reject) {
                  oModel.read("/SalesOrderLineItemSet", {
                    filters: [oProductsOrGroup],
                    urlParameters: {
                      $select: "SalesOrderID",
                      $skiptoken: sSkipToken,
                    },
                    success: function (oData) {
                      try {
                        var aRes = oData && oData.results ? oData.results : [];
                        aRes.forEach(function (r) {
                          aCollectedIDs.push(r.SalesOrderID);
                        });
                        sNextSkipToken =
                          oData && oData.__next ? oData.__next : null;
                        resolve();
                      } catch (e) {
                        reject(e);
                      }
                    },
                    error: function (oErr) {
                      reject(oErr);
                    },
                  });
                });
              }

              // De-duplicate
              var seen = Object.create(null);
              aSOFromProducts = aCollectedIDs.filter(function (id) {
                if (seen[id]) {
                  return false;
                }
                seen[id] = true;
                return true;
              });

              console.log(
                "[_applyAllFilters] SalesOrderIDs from Product lookup:",
                aSOFromProducts
              );
            } catch (e) {
              console.error(
                "[_applyAllFilters] Product lookup failed; continuing without product filter. Error:",
                e
              );
              aSOFromProducts = [];
            }
          }
        }

        var aSOCombined = [];
        if (aSOKeys.length > 0 && aSOFromProducts.length > 0) {
          // Intersection
          var setFromProducts = Object.create(null);
          aSOFromProducts.forEach(function (id) {
            setFromProducts[id] = true;
          });
          aSOCombined = aSOKeys.filter(function (id) {
            return !!setFromProducts[id];
          });
        } else if (aSOKeys.length > 0) {
          aSOCombined = aSOKeys.slice();
        } else if (aSOFromProducts.length > 0) {
          aSOCombined = aSOFromProducts.slice();
        } else {
          aSOCombined = []; // none selected
        }

        var aGroups = [];

        if (aSOCombined.length > 0) {
          var aPerSO = aSOCombined.map(function (id) {
            return new Filter("SalesOrderID", FilterOperator.EQ, id);
          });
          aGroups.push(new Filter({ and: false, filters: aPerSO })); // OR group
        }

        if (aBPKeys.length > 0) {
          // On SalesOrderSet the property is CustomerID (equals BusinessPartnerID)
          var aPerCustomer = aBPKeys.map(function (bpId) {
            return new Filter("CustomerID", FilterOperator.EQ, bpId);
          });
          aGroups.push(new Filter({ and: false, filters: aPerCustomer })); // OR group
        }

        // Special case: if both groups were requested and intersection above produced NONE,
        // we should force an empty result rather than returning full list.
        if (
          (aSOKeys.length > 0 || aPRKeys.length > 0) &&
          aBPKeys.length > 0 &&
          aSOCombined.length === 0
        ) {
          // Impossible predicate to return empty set
          oBinding.filter(
            new Filter("SalesOrderID", FilterOperator.EQ, "__NO_MATCH__"),
            sap.ui.model.FilterType.Application
          );
        } else if (aGroups.length > 0) {
          var oFinal = new Filter({ and: true, filters: aGroups }); // AND across groups
          oBinding.filter(oFinal, sap.ui.model.FilterType.Application);
        } else {
          // No tokens anywhere → clear to full list
          oBinding.filter([], sap.ui.model.FilterType.Application);
        }

        if (oBinding.refresh) {
          oBinding.refresh(true);
        }
      },

      onValueHelpDialogOk: function (oEvent) {
        var aTokens = oEvent.getParameter("tokens") || [];
        var oDlg = oEvent.getSource();

        if (this._currentMI) {
          this._currentMI.removeAllTokens();
          aTokens.forEach(
            function (t) {
              this._currentMI.addToken(
                new sap.m.Token({
                  key: t.getKey(), // ID
                  text: t.getText(), // "Description (ID)"
                })
              );
            }.bind(this)
          );
        }

        var that = this;
        Promise.resolve().then(function () {
          that._applyAllFilters();
        });

        if (oDlg) {
          this.getView().removeDependent(oDlg);
          oDlg.close();
          oDlg.destroy();
        }
      },

      onValueHelpDialogCancel: function (oEvent) {
        oEvent.getSource().close();
      },

      onValueHelpDialogAfterClose: function (oEvent) {
        // Get the dialog instance that was closed
        var oValueHelpDialog = oEvent.getSource();

        // Reset any arrays or state you are using to track selections
        this._aSelectedItems = [];

        // Reset the reference to the MultiInput control
        this._currentMI = null;

        // Reset the reference to the basic search field
        this._oBasicSearchField = null;

        // If the dialog has a filter bar, clear its basic search field
        if (oValueHelpDialog && oValueHelpDialog.getFilterBar) {
          var oFilterBar = oValueHelpDialog.getFilterBar();
          if (oFilterBar) {
            oFilterBar.setBasicSearch(null);
          }
        }

        // Remove the dialog as a dependent of the view, so it does not stay attached
        if (oValueHelpDialog) {
          this.getView().removeDependent(oValueHelpDialog);
        }

        // Destroy the dialog completely to ensure a fresh instance is created
        // next time it is opened (avoids reusing stale state)
        if (oValueHelpDialog) {
          oValueHelpDialog.destroy();
        }
      },

      onMultiInputTokenUpdate: function (oEvent) {
        var that = this;

        // Defer to the next tick so the MultiInput has applied add/remove
        Promise.resolve().then(function () {
          that._applyAllFilters();
        });
      },

      onFilterBarSearch: function (oEvent) {
        const aFilterItems = oEvent.getParameter("selectionSet");
        const aFilters = aFilterItems.reduce((aResult, oControl) => {
          if (oControl.getValue) {
            aResult.push(
              new Filter({
                path: oControl.getName(),
                operator: FilterOperator.Contains,
                value1: oControl.getValue(),
              })
            );
          }
          return aResult;
        }, []);

        const oValueHelpDialog = oEvent.getSource().getParent();
        if (oValueHelpDialog) {
          const oTable = oValueHelpDialog.getTable();
          if (oTable) {
            const oBinding = oTable.getBinding("items");
            if (oBinding) {
              oBinding.filter(aFilters, FilterType.Application);
              oBinding.refresh();
            } else {
              MessageToast.show("Table binding not found for filtering");
            }
          } else {
            MessageToast.show("Table not found in value help dialog.");
          }
        }
      },

      onGroupByBillingOverflowToolbarButtonPress: function (oEvent) {
        var oTable = this.byId("idSalesOrderSetTable");
        var oBinding = oTable && oTable.getBinding("items");
        if (!oBinding) {
          oTable.attachEventOnce(
            "updateFinished",
            this.onGroupByBillingOverflowToolbarButtonPress,
            this
          );
          return;
        }

        // Recompute counts from the rows we currently have (after any filters)
        this._rebuildBillingCounts();

        var that = this;

        // GROUP BY BillingStatus (the CODE). Safe for $orderby on ES5.
        var oGroupedSorter = new Sorter(
          "BillingStatus",
          /* descending */ false,
          function (oCtx) {
            var sCode = oCtx.getProperty("BillingStatus") || "";
            var sDesc =
              oCtx.getProperty("BillingStatusDescription") ||
              sCode ||
              "Unknown";
            var iCnt =
              that._billingCounts &&
              typeof that._billingCounts[sCode] === "number"
                ? that._billingCounts[sCode]
                : 0;

            return {
              key: sCode,
              text: sDesc + " (" + iCnt + ")",
            };
          }
        );

        // Secondary sorter inside each group
        var oBySalesOrderId = new Sorter("SalesOrderID", false);

        // Apply sorters to the existing binding (no rebind, no protected APIs)
        oBinding.sort([oGroupedSorter, oBySalesOrderId]);
      },

      onClearGroupingOverflowToolbarButtonPress: function () {
        var oTable = this.byId("idSalesOrderSetTable");
        if (!oTable) {
          return;
        }
        var oBinding = oTable && oTable.getBinding("items");
        if (!oBinding) {
          return;
        }

        // Remove all sorters (or set a default one)
        oBinding.sort([]);
        this._rebuildBillingCounts();
      },

      /**
       * Build a { BillingStatusCode -> count } map from the currently loaded
       * and already filtered contexts. Called on data events and before grouping.
       */
      _rebuildBillingCounts: function () {
        var oTable = this.byId("idSalesOrderSetTable");
        var oBinding = oTable && oTable.getBinding("items");
        this._billingCounts = Object.create(null);
        if (!oBinding) {
          return;
        }

        var iLen = oBinding.getLength();
        var aCtx = oBinding.getContexts(0, iLen);

        for (var i = 0; i < aCtx.length; i++) {
          var oObj = aCtx[i].getObject();
          if (!oObj) {
            continue;
          }
          var sCode = oObj.BillingStatus || "";
          this._billingCounts[sCode] = (this._billingCounts[sCode] || 0) + 1;
        }
      },

      onColumnListItemPress: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext("salesOrder");
        if (!oCtx) {
          return;
        }
        var m = /SalesOrderSet\('([^']+)'\)/.exec(oCtx.getPath());
        var sId = m && m[1];
        if (!sId) {
          return;
        }

        this.oRouter.navTo("detail", {
          SalesOrderID: sId,
          layout: sap.f.LayoutType.TwoColumnsMidExpanded
        });
      },
    });
  }
);
