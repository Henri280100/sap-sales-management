sap.ui.define(
  [
    "sap/f/library",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/ui/model/Sorter",
    "sap/m/Label",
    "sap/m/SearchField",
    "sap/m/MessageToast",
    "sap/m/ColumnListItem",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/GroupHeaderListItem",
  ],
  function (
    fioriLibrary,
    Controller,
    Filter,
    FilterOperator,
    FilterType,
    Sorter,
    Label,
    SearchField,
    MessageToast,
    ColumnListItem,
    UIColumn,
    Column,
    Text,
    groupHeaderListItem
  ) {
    "use strict";

    return Controller.extend("sap.ui.smt.controller.SaleOrderList", {
      onInit: function () {
        this._oVHD = null;
        this._vhdConfig = null;
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

        oModel.read("/SalesOrderSet", {
          success: function (oData) {
            if (Array.isArray(oData.results)) {
              this._rebuildDeliveryCounts(oData.results);
            } else {
              console.warn("SalesOrderSet is not an array.");
            }
          }.bind(this),
          error: function (oError) {
            console.error("Failed to load SalesOrderSet", oError);
          },
        });

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
      // _getDefaultTokens: function () {
      //   var aTokens = [];
      //   var oModel = this.getOwnerComponent().getModel("salesOrder");

      //   // Example: preload product PD-103
      //   var oContext = oModel.createKey("/ProductSet", {
      //     ProductID: "HT-1000",
      //   });
      //   oModel.read(oContext, {
      //     success: function (oData) {
      //       aTokens.push(
      //         new sap.m.Token({
      //           key: oData.ProductID,
      //           text: oData.Name + " (" + oData.ProductID + ")",
      //         })
      //       );
      //     },
      //   });

      //   // Example: preload Sales Order 0500000001
      //   var oContext2 = oModel.createKey("/SalesOrderSet", {
      //     SalesOrderID: "0500000001",
      //   });
      //   oModel.read(oContext2, {
      //     success: function (oData) {
      //       aTokens.push(
      //         new sap.m.Token({
      //           key: oData.SalesOrderID,
      //           text: oData.CustomerName + " (" + oData.SalesOrderID + ")",
      //         })
      //       );
      //     },
      //   });

      //   return aTokens;
      // },

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

        this._vhdConfig = config;

        await new Promise((resolve, reject) => {
          this.loadFragment({
            id: this.getView().getId(),
            name: "sap.ui.smt.view.fragment.ValueHelpDialog",
            controller: this,
          })
            .then(
              function (oValueHelpDialog) {
                this._oVHD = oValueHelpDialog;
                // Keep a reference for cleanup
                try {
                  this.getView().addDependent(oValueHelpDialog);
                } catch (e) {
                  reject(
                    new Error("Failed to add dialog as dependent: " + e.message)
                  );
                  return;
                }

                // when opening

                // on afterClose
                oValueHelpDialog.attachAfterClose(
                  function () {
                    this.getView().removeDependent(oValueHelpDialog);
                    oValueHelpDialog.destroy();
                    this._oVHD = null; // <-- clear ref
                  }.bind(this)
                );

                // Resolve model once; reject if not present
                let oModel;
                try {
                  oModel = this.getOwnerComponent().getModel("salesOrder");
                  if (!oModel || !(oModel instanceof sap.ui.model.Model)) {
                    reject(
                      new Error("SalesOrder model is not available or invalid.")
                    );
                    return;
                  }
                  oValueHelpDialog.setModel(oModel);
                } catch (e) {
                  reject(
                    new Error("Failed to get/set model on dialog: " + e.message)
                  );
                  return;
                }

                // Safety: must have a dialog
                if (!oValueHelpDialog) {
                  reject(new Error("ValueHelpDialog is not initialized."));
                  return;
                }

                // Configure basics
                try {
                  oValueHelpDialog.setTitle(config.title);
                  oValueHelpDialog.setKey(config.key);
                  oValueHelpDialog.setDescriptionKey(config.key);

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

                  const oFilterBar =
                    oValueHelpDialog.getFilterBar &&
                    oValueHelpDialog.getFilterBar();
                  if (oFilterBar) {
                    oFilterBar.setFilterBarExpanded(false);
                    oFilterBar.setBasicSearch(this._oBasicSearchField);
                    this._oBasicSearchField.attachSearch(function () {
                      oFilterBar.search();
                    });
                  }
                } catch (e) {
                  reject(new Error("Failed to configure dialog: " + e.message));
                  return;
                }

                // Build the inner table (sap.ui.table.Table or sap.m.Table)
                oValueHelpDialog
                  .getTableAsync()
                  .then(
                    function (oTable) {
                      try {
                        oTable.setModel(oModel);

                        if (oTable.bindRows) {
                          // -------- Desktop: sap.ui.table.Table --------
                          oTable.bindAggregation("rows", {
                            path: config.entitySet,
                            events: {
                              dataReceived: function (oEvent) {
                                console.log(
                                  "VHD rows data:",
                                  oEvent.getParameter("data")
                                );
                                oValueHelpDialog.update();
                              },
                            },
                          });

                          oTable.removeAllColumns();
                          config.columns.forEach(function (col) {
                            const oColumn = new sap.ui.table.Column({
                              label: new Label({ text: col.label }),
                              template: new Text({
                                text: "{" + col.name + "}",
                              }),
                            });
                            oColumn.data({ fieldName: col.name });
                            oTable.addColumn(oColumn);
                          });
                        } else if (oTable.bindItems) {
                          // -------- Mobile: sap.m.Table --------
                          oTable.bindAggregation("items", {
                            path: config.entitySet,
                            template: new ColumnListItem({
                              cells: config.columns.map(function (col) {
                                return new Label({
                                  text: "{" + col.name + "}",
                                });
                              }),
                            }),
                            events: {
                              dataReceived: function (oEvent) {
                                // console.log("VHD items data:", oEvent.getParameter("data"));
                                oValueHelpDialog.update();
                              },
                            },
                          });

                          oTable.removeAllColumns();
                          config.columns.forEach(function (col) {
                            oTable.addColumn(
                              new Column({
                                header: new Label({ text: col.label }),
                              })
                            );
                          });
                        } else {
                          reject(
                            new Error(
                              "Unsupported table type inside ValueHelpDialog."
                            )
                          );
                          return;
                        }

                        // Initial tokens from the triggering MultiInput
                        try {
                          if (this._currentMI && this._currentMI.getTokens) {
                            oValueHelpDialog.setTokens(
                              this._currentMI.getTokens()
                            );
                          }
                        } catch (e) {
                          // Not fatal; continue
                        }

                        // Wire OK / Cancel / AfterClose
                        let sAction = "closed";

                        oValueHelpDialog.attachOk(
                          function (e) {
                            try {
                              sAction = "ok";
                              const aTokens = e.getParameter("tokens") || [];
                              if (this._currentMI) {
                                this._currentMI.removeAllTokens();
                                aTokens.forEach(
                                  function (t) {
                                    this._currentMI.addToken(
                                      new sap.m.Token({
                                        key: t.getKey(),
                                        text: t.getText(),
                                      })
                                    );
                                  }.bind(this)
                                );
                              }
                              // Re-apply your filters after selection
                              if (this._applyAllFilters) {
                                this._applyAllFilters();
                              }
                            } catch (err) {
                              reject(
                                new Error(
                                  "Failed to apply tokens: " + err.message
                                )
                              );
                              return;
                            } finally {
                              oValueHelpDialog.close();
                            }
                          }.bind(this)
                        );

                        oValueHelpDialog.attachCancel(function () {
                          sAction = "cancel";
                          oValueHelpDialog.close();
                        });

                        oValueHelpDialog.attachAfterClose(
                          function () {
                            try {
                              this.getView().removeDependent(oValueHelpDialog);
                            } catch (e) {
                              /* ignore */
                            }
                            try {
                              oValueHelpDialog.destroy();
                            } catch (e) {
                              /* ignore */
                            }
                            resolve({ action: sAction });
                          }.bind(this)
                        );

                        // Finally open
                        oValueHelpDialog.open();
                      } catch (e) {
                        reject(
                          new Error(
                            "Failed during table setup/open: " + e.message
                          )
                        );
                      }
                    }.bind(this)
                  )
                  .catch(function (err) {
                    reject(new Error("getTableAsync failed: " + err.message));
                  });
              }.bind(this)
            )
            .catch(function (err) {
              reject(new Error("loadFragment failed: " + err.message));
            });
        });
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
            // OR group: ProductID ...
            var aProductFilters = aPRKeys.map(function (pid) {
              return new Filter("ProductID", FilterOperator.EQ, pid);
            });
            var oProductsOrGroup = new Filter({
              and: false,
              filters: aProductFilters,
            });

            var aCollectedIDs = [];
            var sNextSkipToken = null;

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

        if (oValueHelpDialog && oValueHelpDialog.getFilterBar) {
          var oFilterBar = oValueHelpDialog.getFilterBar();
          if (oFilterBar) {
            oFilterBar.setBasicSearch(null);
          }
        }

        if (this._oBasicSearchField && this._oBasicSearchField.setValue) {
          this._oBasicSearchField.setValue("");
        }

        if (oValueHelpDialog) {
          this.getView().removeDependent(oValueHelpDialog);
        }

        if (oValueHelpDialog) {
          oValueHelpDialog.destroy();
        }
      },

      onMultiInputTokenUpdate: function (oEvent) {
        var that = this;

        Promise.resolve().then(function () {
          that._applyAllFilters();
        });
      },

      _buildVhdFilters: function () {
        // Use the last VHD config we stored when opening the dialog
        var cfg = this._vhdConfig || {};
        var aFilters = [];

        // Pull the Basic Search text (you already set this._oBasicSearchField)
        var sQuery =
          (this._oBasicSearchField &&
            this._oBasicSearchField.getValue &&
            this._oBasicSearchField.getValue()) ||
          "";
        sQuery = (sQuery || "").trim();

        if (!sQuery) {
          return aFilters; // no search → no filters
        }

        // Decide which fields to search per entity set
        var aFields = [];
        switch (cfg.entitySet) {
          case "/SalesOrderSet":
            aFields = ["SalesOrderID", "CustomerName"];
            break;
          case "/BusinessPartnerSet":
            aFields = ["BusinessPartnerID", "CompanyName"];
            break;
          case "/ProductSet":
            aFields = ["ProductID", "Name", "Category"];
            break;
          default:
            // Fallback: try generic fields
            aFields = [cfg.key || "SalesID", "Name"];
        }

        // Build an OR filter: (field1 contains q) OR (field2 contains q) OR ...
        var aOr = aFields.map(function (sPath) {
          return new Filter(sPath, FilterOperator.Contains, sQuery);
        });

        if (aOr.length) {
          aFilters.push(new Filter({ filters: aOr, and: false }));
        }

        return aFilters;
      },

      onFilterBarSearch: function () {
        if (!this._oVHD) {
          MessageToast.show("Value help dialog not ready.");
          return;
        }
        this._oVHD.getTableAsync().then(
          function (oTable) {
            var sAgg = oTable.bindRows ? "rows" : "items";
            var oBinding = oTable.getBinding(sAgg);
            if (oBinding) {
              var aFilters = this._buildVhdFilters();
              oBinding.filter(aFilters, FilterType.Application);
              this._oVHD.update();
            }
          }.bind(this)
        );
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

        this._rebuildBillingCounts();

        var that = this;

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

        // Apply sorters to the existing binding
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
        var sId = oCtx.getProperty("SalesOrderID"); // <-- raw ID like "0500000001"

        this.oRouter.navTo("detail", {
          SalesOrderID: sId,
          layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
        });
      },

      _rebuildDeliveryCounts: function (aSalesOrders) {
        this._deliveryCounts = {};

        aSalesOrders.forEach(
          function (oOrder) {
            var sStatus = oOrder.DeliveryStatus || "Initial";
            if (!this._deliveryCounts[sStatus]) {
              this._deliveryCounts[sStatus] = 0;
            }
            this._deliveryCounts[sStatus]++;
          }.bind(this)
        );
      },

      createDeliveryGroupHeader: function (oGroup) {
        var sGroupLabel = oGroup?.key || "Initial";

        var iCount = this._deliveryCounts?.[sGroupLabel] ?? 0;

        return new groupHeaderListItem({
          title: "Delivery Status: " + sGroupLabel,
          count: iCount,
        });
      },
    });
  }
);
