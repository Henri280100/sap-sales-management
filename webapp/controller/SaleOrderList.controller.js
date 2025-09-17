sap.ui.define(
  [
    "sap/f/library",
    "sap/m/library",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/ui/model/Sorter",
    "sap/ui/model/BindingMode",
    "sap/m/Label",
    "sap/m/SearchField",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/ColumnListItem",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/GroupHeaderListItem",
    "sap/ui/smt/utils/SearchUtils",
    "sap/ui/smt/utils/ValueHelpUtils",
    "sap/ui/smt/utils/TableUtils",
    "sap/m/Token",
    "sap/ui/core/Fragment",
    "sap/m/ListMode",
    "sap/ui/model/json/JSONModel",
  ],
  function (
    fioriLibrary,
    MLibrary,
    Controller,
    Filter,
    FilterOperator,
    FilterType,
    Sorter,
    BindingMode,
    Label,
    SearchField,
    MessageToast,
    MessageBox,
    ColumnListItem,
    UIColumn,
    Column,
    Text,
    GroupHeaderListItem,
    SearchUtils,
    VhdUtils,
    TableUtils,
    Token,
    Fragment,
    ListMode,
    JSONModel
  ) {
    "use strict";

    return Controller.extend("sap.ui.smt.controller.SaleOrderList", {
      onInit: function () {
        // --- Init members ---
        // --- Init View ----
        this._sGroupChoice = "delivery";
        this._oGroupDlg = null;
        this._inRebind = false;

        this._soDialog = null;
        this._soDialogMode = "create";
        this._soDialogKey = null;

        this.oSaleOrderTable = this.getView().byId("idSalesOrderSetTable");
        this._oVHD = null; // Value Help Dialog reference
        this._vhdConfig = null; // Config for current VHD
        this.oRouter = this.getOwnerComponent().getRouter();
        this._oBasicSearchField = new SearchField();

        if (this.oSaleOrderTable && this.oSaleOrderTable.setMode) {
          this.oSaleOrderTable.setMode(ListMode.MultiSelect);
        }

        // MultiInput references
        this._oMultiInput = {
          salesOrderMI: this.byId("idSalesOrderIDMultiInput"),
          customerNameMI: this.byId("idCustomerNameMultiInput"),
          productMI: this.byId("idProductIDMultiInput"),
        };

        // --- Setup model ---
        var oSalesModel = this.getOwnerComponent().getModel("salesOrder");

        oSalesModel.setDefaultBindingMode(BindingMode.TwoWay);
        oSalesModel.setUseBatch(true);

        this.oSaleOrderTable.setModel(oSalesModel, "salesOrder");
        this.oModel = oSalesModel;

        var oSoForm = new JSONModel({
          CustomerID: "0100000000",
          CustomerName: "",
          CurrencyCode: "EUR",
          NetAmount: "0.00",
          TaxAmount: "0.00",
          GrossAmount: "0.00", // optional; you can compute on OK before sending
          LifecycleStatus: "N",
          BillingStatus: "N",
          DeliveryStatus: "N",
          Note: "",
        });

        this.getView().setModel(oSoForm, "soForm");

        // Ensure metadata is loaded before anything else
        oSalesModel.metadataLoaded().then(() => {
          console.log("SalesOrder metadata loaded.");
        });

        // --- Attach binding events for counts ---
        const attachBindingEvents = function () {
          this._mainBinding = this.oSaleOrderTable.getBinding("items");
          // keep counts fresh
          if (this._mainBinding) {
            this._mainBinding.attachChange(this._onBindingChanged, this);
            this._mainBinding.attachDataReceived(this._onBindingChanged, this);
          }
        }.bind(this);

        // If binding exists now, attach immediately, else wait for first fill
        if (this.oSaleOrderTable.getBinding("items")) {
          this._applyGroupChoice("delivery");
          attachBindingEvents();
        } else {
          // IMPORTANT: attach to the TABLE, not the binding
          this.oSaleOrderTable.attachEventOnce(
            "updateFinished",
            function () {
              this._applyGroupChoice("delivery");
              attachBindingEvents();
            },
            this
          );
        }
      },

      // Sort table
      onSortOverflowToolbarButtonPress: function () {
        var oTable = this.oSaleOrderTable;
        if (!oTable) {
          return;
        }

        var oBinding = oTable.getBinding("items");
        if (!oBinding) {
          return;
        }

        // Toggle direction (store sort state on the controller)
        this._sortState = this._sortState || {
          path: "SalesOrderID",
          desc: false,
        };
        this._sortState.desc = !this._sortState.desc;

        // If there's already the same sorter applied, do nothing
        var aExisting = (oBinding.getSorters && oBinding.getSorters()) || [];
        if (
          aExisting.length === 1 &&
          aExisting[0].sPath === this._sortState.path &&
          !!aExisting[0].bDescending === !!this._sortState.desc
        ) {
          return; // no change → no roundtrip or re-render
        }

        var oSorter = new Sorter(this._sortState.path, this._sortState.desc);

        // Perf: suspend to avoid intermediate refreshes while applying sorters
        if (oBinding.suspend) {
          oBinding.suspend();
        }

        oTable.setBusy(true);

        // Apply sort in one shot
        if (oBinding.sort) {
          oBinding.sort([oSorter]);
        }

        // Resume + wait for data to finish before un-busying
        var onDone = function () {
          oTable.setBusy(false);
        };
        if (oBinding.resume) {
          oBinding.resume();
        }

        // In OData V2 a sort triggers a read → use dataReceived once
        if (oBinding.attachDataReceived) {
          oBinding.attachDataReceived(function fnOnce() {
            oBinding.detachDataReceived(fnOnce);
            onDone();
          });
        } else {
          // Fallback (non-OData bindings)
          setTimeout(onDone, 0);
        }
      },

      onMultiInputValueHelpRequest: async function (oEvent) {
        this._currentMI = oEvent.getSource();
        const config = VhdUtils.resolveConfig(this, this._currentMI); // helper to pick config by MI
        this._vhdConfig = config;

        if (!config) {
          MessageToast.show("Invalid value help request.");
          return;
        }

        // ✅ load fragment only once
        if (!this._oVHD) {
          this._oVHD = await this.loadFragment({
            id: this.getView().getId(),
            name: "sap.ui.smt.view.fragment.ValueHelpDialog",
            controller: this,
          });
          this.getView().addDependent(this._oVHD);

          // cleanup when closed
          this._oVHD.attachAfterClose(() => {
            this._currentMI = null;
          });

          // configure filter bar once
          const oFilterBar = this._oVHD.getFilterBar();
          if (oFilterBar) {
            oFilterBar.setFilterBarExpanded(false);
            oFilterBar.setBasicSearch(this._oBasicSearchField);
            this._oBasicSearchField.attachSearch(() => oFilterBar.search());
          }
        }

        // configure each open (title, key, columns, binding…)
        VhdUtils.configureVHD(
          this._oVHD,
          this._vhdConfig,
          this.oModel,
          this._currentMI.getTokens()
        );

        // open instantly, data will load in background
        this._oVHD.open();
      },

      _applyAllFilters: async function () {
        if (this._isApplyingFilters) {
          return;
        }
        this._isApplyingFilters = true;

        try {
          var oTable = this.byId("idSalesOrderSetTable");
          if (!oTable) {
            return;
          }

          var oBinding = oTable.getBinding("items");
          if (!oBinding) {
            return;
          }

          // Make sure filtering is done on the client (prevents server $orderby/$filter issues)
          if (oBinding.changeParameters) {
            oBinding.changeParameters({ operationMode: "Client" });
          }

          // --- Collect token keys ---
          var aSOKeys = (
            this._oMultiInput &&
            this._oMultiInput.salesOrderMI &&
            this._oMultiInput.salesOrderMI.getTokens
              ? this._oMultiInput.salesOrderMI.getTokens()
              : []
          )
            .map(function (t) {
              return t.getKey();
            })
            .filter(Boolean);

          var aBPKeys = (
            this._oMultiInput &&
            this._oMultiInput.customerNameMI &&
            this._oMultiInput.customerNameMI.getTokens
              ? this._oMultiInput.customerNameMI.getTokens()
              : []
          )
            .map(function (t) {
              return t.getKey();
            })
            .filter(Boolean); // BusinessPartnerID

          var aPRKeys = (
            this._oMultiInput &&
            this._oMultiInput.productMI &&
            this._oMultiInput.productMI.getTokens
              ? this._oMultiInput.productMI.getTokens()
              : []
          )
            .map(function (t) {
              return t.getKey();
            })
            .filter(Boolean); // ProductID

          // --- If product tokens exist, resolve to SalesOrderIDs via SalesOrderLineItemSet ---
          var aSOFromProducts = [];
          if (aPRKeys.length > 0) {
            var oModel = this.getOwnerComponent().getModel("salesOrder");
            if (oModel) {
              try {
                aSOFromProducts = await new Promise(function (resolve, reject) {
                  var Filter = Filter;
                  var OP = FilterOperator;

                  // OR(ProductID = pid1, pid2, ...)
                  var aProdFilters = aPRKeys.map(function (pid) {
                    return new Filter("ProductID", OP.EQ, pid);
                  });

                  oModel.read("/SalesOrderLineItemSet", {
                    filters: [
                      new Filter({ and: false, filters: aProdFilters }),
                    ],
                    urlParameters: { $select: "SalesOrderID" },
                    success: function (oData) {
                      var ids = (
                        oData && oData.results ? oData.results : []
                      ).map(function (r) {
                        return r.SalesOrderID;
                      });
                      // de-duplicate
                      var seen = Object.create(null);
                      ids = ids.filter(function (id) {
                        if (seen[id]) {
                          return false;
                        }
                        seen[id] = true;
                        return true;
                      });
                      resolve(ids);
                    },
                    error: reject,
                  });
                });
              } catch (e) {
                // fail-soft: if lookup fails, ignore product restriction
                aSOFromProducts = [];
              }
            }
          }

          // --- Combine SalesOrderIDs (intersection when both are present) ---
          var aSOCombined;
          if (aSOKeys.length && aSOFromProducts.length) {
            var mSeen = Object.create(null);
            aSOFromProducts.forEach(function (id) {
              mSeen[id] = true;
            });
            aSOCombined = aSOKeys.filter(function (id) {
              return !!mSeen[id];
            });
          } else if (aSOKeys.length) {
            aSOCombined = aSOKeys.slice();
          } else {
            aSOCombined = aSOFromProducts.slice();
          }

          // --- Build client filters and apply ---
          var Filter = sap.ui.model.Filter;
          var OP = sap.ui.model.FilterOperator;
          var FT = sap.ui.model.FilterType;

          var aGroups = [];

          if (aSOCombined.length) {
            aGroups.push(
              new Filter({
                and: false,
                filters: aSOCombined.map(function (id) {
                  return new Filter("SalesOrderID", OP.EQ, id);
                }),
              })
            );
          }

          if (aBPKeys.length) {
            // Header uses CustomerID (same value as BusinessPartnerID)
            aGroups.push(
              new Filter({
                and: false,
                filters: aBPKeys.map(function (bp) {
                  return new Filter("CustomerID", OP.EQ, bp);
                }),
              })
            );
          }

          // If both dimensions requested but intersection is empty → show no rows
          if (
            (aSOKeys.length || aPRKeys.length) &&
            aBPKeys.length &&
            aSOCombined.length === 0
          ) {
            oBinding.filter(
              [new Filter("SalesOrderID", OP.EQ, "__NO_MATCH__")],
              FT.Application
            );
            return;
          }

          if (aGroups.length) {
            oBinding.filter(
              new Filter({ and: true, filters: aGroups }),
              FT.Application
            );
          } else {
            // No tokens at all → clear filters to show full list (client-side)
            oBinding.filter([], FT.Application);
          }

          // No sorting/grouping/refresh here – just filtering.
        } finally {
          this._isApplyingFilters = false;
        }
      },

      onValueHelpDialogOk: function (oEvent) {
        // 1) Apply picked tokens to the triggering MultiInput
        var aTokens = oEvent.getParameter("tokens") || [];
        if (this._currentMI) {
          this._currentMI.removeAllTokens();
          for (var i = 0; i < aTokens.length; i++) {
            var t = aTokens[i];
            this._currentMI.addToken(
              new Token({ key: t.getKey(), text: t.getText() })
            );
          }
        }

        // 2) Clear VHD filter/search state so it won’t leak into the next open
        var oDlg = oEvent.getSource();
        try {
          var oFB = oDlg.getFilterBar && oDlg.getFilterBar();
          if (oFB && oFB.search) {
            if (this._oBasicSearchField && this._oBasicSearchField.setValue) {
              this._oBasicSearchField.setValue("");
            }
            // This will run your FilterBar 'search' handler, which should clear dialog filters.
            oFB.search();
          }
        } catch (e) {
          // no-op
        }

        // 3) Close dialog immediately (UI5 will start its close animation/teardown)
        oDlg.close();
        var maybePromise = this._applyAllFilters();
        var afterFilters =
          maybePromise && typeof maybePromise.then === "function"
            ? maybePromise
            : Promise.resolve();

        afterFilters
          .then(function () {
            return Promise.resolve(); // microtask hop
          })
          .then(
            function () {
              var b =
                this.byId("idSalesOrderSetTable") &&
                this.byId("idSalesOrderSetTable").getBinding("items");
              if (b && b.resume && b.isSuspended && b.isSuspended()) {
                b.resume();
              }
              // If you’re not suspending bindings elsewhere, this is harmless and fast.
            }.bind(this)
          )
          .catch(function (err) {
            // Keep errors from bubbling to the UI thread
            // (optional: show a MessageToast)
            // MessageToast.show("Apply filters failed: " + (err && err.message));
            // console.error(err);
          });
      },

      onValueHelpDialogCancel: function (oEvent) {
        TableUtils.resetVhdTableFilters();
        oEvent.getSource().close();
        setTimeout(
          function () {
            var b = TableUtils.getMainBinding();
            if (b && b.resume) {
              b.resume();
            }
          }.bind(this),
          0
        );
      },

      onValueHelpDialogAfterClose: function (oEvent) {
        var oVHD = oEvent.getSource();

        // reset controller state
        this._aSelectedItems = [];
        this._currentMI = null;
        this._vhdConfig = null;

        // clear search field if reused
        if (this._oBasicSearchField?.setValue) {
          this._oBasicSearchField.setValue("");
        }

        // unlink filter bar search field
        var oFilterBar = oVHD?.getFilterBar && oVHD.getFilterBar();
        if (oFilterBar) {
          oFilterBar.setBasicSearch(null);
        }

        // clean up dialog
        if (oVHD) {
          this.getView().removeDependent(oVHD);
          oVHD.destroy();
        }

        this._oVHD = null;
      },

      onMultiInputTokenUpdate: function (oEvent) {
        var that = this;

        Promise.resolve().then(function () {
          that._applyAllFilters();
        });
      },

      // Table search (top SearchField)
      onSearchFieldSearch: function (oEvent) {
        var sQuery = (oEvent.getParameter("query") || "").trim();
        var oTable = this.byId("idSalesOrderSetTable");
        if (!oTable) return;
        var oBinding = oTable.getBinding("items");
        if (!oBinding) return;

        var aFields = SearchUtils.getSearchFieldsForEntitySet(
          "/SalesOrderSet",
          null
        );
        SearchUtils.applySearchToBinding(oBinding, aFields, sQuery);
      },

      // ValueHelpDialog FilterBar search
      onFilterBarSearch: function () {
        if (!this._oVHD) return;

        var sQuery = (
          (this._oBasicSearchField &&
            this._oBasicSearchField.getValue &&
            this._oBasicSearchField.getValue()) ||
          ""
        ).trim();
        var cfg = this._vhdConfig || {};
        var aFields = SearchUtils.getSearchFieldsForEntitySet(
          cfg.entitySet,
          cfg.key
        );

        this._oVHD.getTableAsync().then(
          function (oTable) {
            var sAgg = oTable.bindRows ? "rows" : "items";
            var oBinding = oTable.getBinding(sAgg);
            if (oBinding) {
              SearchUtils.applySearchToBinding(oBinding, aFields, sQuery); // clears when empty
              this._oVHD.update && this._oVHD.update();
            }
          }.bind(this)
        );
      },

      _onBindingChanged: function () {
        if (this._inRebind) return;
        this._applyGroupChoice(this._sGroupChoice);
      },

      _getRBKey: function (oBtn) {
        if (!oBtn) return null;
        const cd =
          oBtn.getCustomData &&
          oBtn.getCustomData().find((d) => d.getKey && d.getKey() === "key");
        return cd && cd.getValue
          ? cd.getValue()
          : typeof oBtn.data === "function"
          ? oBtn.data("key")
          : null;
      },

      onRadioButtonGroupSelect: function (oEvent) {
        const oGroup = oEvent.getSource();
        const idx = oEvent.getParameter("selectedIndex");
        const btn = oGroup.getButtons()[idx];
        const key = this._getRBKey(btn);
        if (key) this._sGroupChoice = key;
      },

      onGroupsOverflowToolbarButtonPress: async function () {
        const oView = this.getView();

        // tạo prefix riêng cho fragment (an toàn ID)
        if (!this._grpFragId) this._grpFragId = oView.createId("GroupByDlg");

        if (!this._oGroupDlg) {
          const oFragment = await Fragment.load({
            id: this._grpFragId,
            name: "sap.ui.smt.view.fragment.GroupByDialog",
            controller: this,
          });
          this._oGroupDlg = Array.isArray(oFragment) ? oFragment[0] : oFragment;
          oView.addDependent(this._oGroupDlg);
        }

        // lấy đúng RBG trong fragment
        const oRBG = Fragment.byId(
          this._grpFragId,
          "idGroupByRadioButtonGroup"
        );
        if (oRBG) {
          var aBtns = oRBG.getButtons();

          var isDefault = this._sGroupChoice || "delivery";
          var iIdx = aBtns.findIndex((b) => b.data("key") === isDefault);
          oRBG.setSelectedIndex(iIdx >= 0 ? iIdx : 0); // fallback about Delivery
        }

        this._oGroupDlg.open();
      },

      onOKButtonPress: function () {
        const oRBG = this.byId("idGroupByRBG");
        let sKey = this._sGroupChoice || "delivery";

        if (oRBG) {
          const i = oRBG.getSelectedIndex();
          const a = oRBG.getButtons();
          if (i > -1 && a[i]) {
            sKey = a[i].data("key") || sKey; // đọc từ CustomData "key"
          }
        }
        // User choose None
        if (!sKey || sKey === "none") sKey === "delivery";

        this._sGroupChoice = sKey;
        this._applyGroupChoice(sKey);
        this._oGroupDlg.close();
      },

      onCancelButtonPress: function () {
        this._oGroupDlg && this._oGroupDlg.close();
      },

      /** helper: build counts from current visible contexts */
      _buildCounts: function (sField) {
        var oTable = this.oSaleOrderTable;
        var mCounts = Object.create(null);
        var oBinding = oTable && oTable.getBinding("items");
        if (!oBinding) return mCounts;

        var len = oBinding.getLength ? oBinding.getLength() : 0;
        var ctxs = oBinding.getContexts ? oBinding.getContexts(0, len) : [];
        for (let i = 0; i < ctxs.length; i++) {
          var obj = ctxs[i].getObject && ctxs[i].getObject();
          if (!obj) continue;
          var k = obj[sField] || "Initial";
          mCounts[k] = (mCounts[k] || 0) + 1;
        }
        return mCounts;
      },

      _applyGroupChoice: function (sKey) {
        var oTable = this.oSaleOrderTable;
        if (!oTable) return;

        var bi = oTable.getBindingInfo("items");
        if (!bi) return;

        // none/null => delivery (default)
        if (!sKey || sKey === "none") {
          sKey = "delivery";
        }

        // decide grouping field & label
        let sField, sTextField, sLabel;
        switch (sKey) {
          case "billing":
            sField = "BillingStatus";
            sTextField = "BillingStatusDescription";
            sLabel = "Billing Status";
            break;
          case "salesorder":
            sField = "SalesOrderID";
            sTextField = "";
            sLabel = "Sales Order";
            break;
          case "customer":
            sField = "CustomerName";
            sTextField = "";
            sLabel = "Customer";
            console.log(sField);
            break;
          // case "none":
          //   this._currentGroupLabel = null;
          //   this._lastCounts = null;

          //   return this._rebindWithoutGrouping(bi);
          case "delivery":
          default:
            sField = "DeliveryStatus";
            sTextField = "DeliveryStatusDescription";
            sLabel = "Delivery Status";
            break;
        }

        // keep label for potential future use
        this._currentGroupLabel = sLabel;

        // counts from currently visible rows (client-side)
        var mCounts = this._buildCounts(sField);
        this._lastCounts = mCounts;
        // dynamic group sorter
        var oGroupSorter = new Sorter(sField, false, (oCtx) => {
          var key = oCtx.getProperty(sField) || "Initial";
          var text = sTextField ? oCtx.getProperty(sTextField) || key : key;
          var cnt = mCounts[key] || 0;
          return { key, text: `${text} (${cnt})` };
        });

        // dynamic header factory with the right label
        var fnHeaderFactory = (oGroup) => {
          var title = `${sLabel}: ${oGroup.text || oGroup.key || ""}`;
          return new GroupHeaderListItem({ title });
        };

        // rebind (client mode) with sorter + dynamic header factory
        this._inRebind = true;
        try {
          oTable.unbindItems();
          oTable.bindItems({
            path: bi.path,
            model: bi.model,
            template:
              bi.template && bi.template.clone
                ? bi.template.clone()
                : bi.template,
            templateShareable: true,
            parameters: Object.assign({}, bi.parameters, {
              operationMode: "Client",
              countMode: "None",
            }),
            sorter: [oGroupSorter],
            groupHeaderFactory: fnHeaderFactory,
          });
        } finally {
          setTimeout(() => (this._inRebind = false), 0);
        }
      },

      // _rebindWithoutGrouping: function (bi) {
      //   var oTable = this.oSaleOrderTable;
      //   this._inRebind = true;
      //   try {
      //     oTable.unbindItems();
      //     oTable.bindItems({
      //       path: bi.path,
      //       model: bi.model,
      //       template:
      //         bi.template && bi.template.clone
      //           ? bi.template.clone()
      //           : bi.template,
      //       templateShareable: true,
      //       parameters: Object.assign({}, bi.parameters, {
      //         operationMode: "Client",
      //         countMode: "None",
      //       }),
      //       sorter: [], // no grouping
      //     });
      //   } finally {
      //     setTimeout(() => (this._inRebind = false), 0);
      //   }
      // },

      onClearGroupingOverflowToolbarButtonPress: function () {
        this._sGroupChoice = "delivery";
        this._applyGroupChoice("delivery");
        MessageToast.show("Grouping reset to Delivery");
      },

      onColumnListItemPress: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext("salesOrder");
        var sId = oCtx.getProperty("SalesOrderID"); // <-- raw ID like "0500000001"

        this.oRouter.navTo("detail", {
          SalesOrderID: sId,
          layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
        });
      },

      createGroupHeader: function (oGroup) {
        var sLabel = this._currentGroupLabel || "Group";
        var sKey = (oGroup && oGroup.key) || "Initial";
        var sText = (oGroup && oGroup.text) || sKey;

        let sTextWithCnt = sText;
        if (!/\(\d+\)$/.test(sText)) {
          var cnt = (this._lastCounts && this._lastCounts[sKey]) || 0;
          sTextWithCnt = `${sText} (${cnt})`;
        }

        return new GroupHeaderListItem({
          title: `${sLabel}: ${sTextWithCnt}`,
        });
      },

      onAddOverflowToolbarButtonPress: async function () {
        var oView = this.getView();
        if (!this._soDialog) {
          const oFragment = await this.loadFragment({
            id: oView.createId("SalesOrderDialog"),
            name: "sap.ui.smt.view.fragment.SalesOrderDialog",
            controller: this,
          });
          this._soDialog = Array.isArray(oFragment) ? oFragment[0] : oFragment;
          oView.addDependent(this._soDialog);

          this.getView().getModel("soForm").setData({
            CustomerID: "0100000000",
            CustomerName: "Demo Customer",
            CurrencyCode: "EUR",
            NetAmount: "100.00",
            TaxAmount: "19.00",
            GrossAmount: "119.00",
            LifecycleStatus: "N",
            BillingStatus: "N",
            DeliveryStatus: "N",
            Note: "Created from UI5",
          });

          this._soDialogMode = "create";
          this._soDialogKey = null;
          this._soDialog.setTitle("Create Sales Order");
          this._soDialog.open();
        }
      },

      onEditOverflowToolbarButtonPress: async function () {
        const oTable = this.oSaleOrderTable;
        const aContext =
          oTable && oTable.getSelectedContexts
            ? oTable.getSelectedContexts()
            : [];

        if (!aContext || aContext.length === 0) {
          return MessageToast.show("Select one Sales Order to update");
        }
        const oObject = aContext[0].getObject();
        if (!oObject || !oObject.SalesOrderID) {
          return MessageToast.show("Invalid selection");
        }

        const oView = this.getView();
        if (!this._soDialog) {
          const oFragment = await this.loadFragment({
            id: oView.createId("SalesOrderDlg"),
            name: "sap.ui.smt.view.fragment.SalesOrderDialog",
            controller: this,
          });
          this._soDialog = Array.isArray(oFragment) ? oFragment[0] : oFragment;
          oView.addDependent(this._soDialog);
        }

        this.getView()
          .getModel("soForm")
          .setData({
            CustomerID: oObject.CustomerID || "",
            CustomerName: oObject.CustomerName || "",
            CurrencyCode: oObject.CurrencyCode || "EUR",
            NetAmount: String(oObject.NetAmount || "0.00"),
            TaxAmount: String(oObject.TaxAmount || "0.00"),
            GrossAmount: String(oObject.GrossAmount || "0.00"),
            LifecycleStatus: oObject.LifecycleStatus || "N",
            DeliveryStatus: oObject.DeliveryStatus || "N",
            Note: oObject.Note || "",
          });

        this._soDialogMode = "edit";
        this._soDialogKey = oObject.SalesOrderID;
        this._soDialog.setTitle("Update Sales Order " + this._soDialogKey);
        this._soDialog.open();
      },

      // DELETE - required a selected row
      onDeleteOverflowToolbarButtonPress: async function () {
        const oSalesOrderTable = this.oSaleOrderTable;
        const aSelectedContexts = oSalesOrderTable.getSelectedContexts()
          ? oSalesOrderTable.getSelectedContexts()
          : [];

        if (!aSelectedContexts || aSelectedContexts.length === 0) {
          return MessageToast.show("Select a Sales Order(s) to deletes");
        }

        MessageBox.confirm(`Delete ${aSelectedContexts.length} items(s)?`, {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: async function (sAction) {
            if (sAction !== MessageBox.Action.OK) return;

            const oODataModel = this.oModel;
            const oItemsBinding = oSalesOrderTable.getBinding("items");

            try {
              oSalesOrderTable.setBusy(true);
              oItemsBinding && oItemsBinding.suspend();

              // stage all deletes into the same batch group
              aSelectedContexts.forEach((oContext) => {
                const sId = oContext.getObject()?.SalesOrderID;
                if (sId)
                  oODataModel.remove(`/SalesOrderSet('${sId}')`, {
                    groupId: "changes",
                  });
              });
              await new Promise((resolve, reject) => {
                oODataModel.submitChanges({
                  groupId: "changes",
                  success: resolve,
                  error: reject,
                });
              });

              oItemsBinding && oItemsBinding.resume();
              oSalesOrderTable.setBusy(false);
              oItemsBinding && oItemsBinding.refresh();
              MessageToast.show("Delete completed");
            } catch (error) {
              oItemsBinding && oItemsBinding.resume();
              oSalesOrderTable.setBusy(false);
              MessageBox.show(
                "Delete failed.\n" + (e?.responseText || e?.message || "")
              );
            }
          },
        });
      },

      // Ok for Create/Edit
      onOKButtonPress: async function () {
        const oODataModel = this.oModel;
        const oSalesOrderTable = this.oSaleOrderTable;
        const oItemsBinding = oSalesOrderTable.getBinding("items");
        const oSoFormModel = this.getView().getModel("soForm");
        const oFormData = { ...oSoFormModel.getData() };

        // Normalize numbers -> two-decimal strings for Gateway
        var to2 = function (v) {
          return (Number(String(v).replace(/[, ]/g, "")) || 0).toFixed(2);
        };

        oFormData.NetAmount = to2(oFormData.NetAmount);
        oFormData.TaxAmount = to2(oFormData.TaxAmount);
        oFormData.GrossAmount = to2(
          Number(oFormData.NetAmount) + Number(oFormData.TaxAmount)
        );
        oFormData.CurrencyCode = (
          oFormData.CurrencyCode || "EUR"
        ).toUpperCase();

        try {
          oSalesOrderTable.setBusy(true);
          oItemsBinding && oItemsBinding.suspend();

          if (this._soDialogMode === "create") {
            oODataModel.create("/SalesOrderSet", oFormData, {
              groupId: "changes",
            });
          } else {
            const sSalesOrderId = this._soDialogKey;
            if (!sSalesOrderId) {
              MessageToast.show("Missing SalesOrderID");
              oItemsBinding && oItemsBinding.resume();
              oSalesOrderTable.setBusy(false);
              return;
            }
            // Stage update (MERGE) into batch group
            oODataModel.update(
              `/SalesOrderSet('${sSalesOrderId}')`,
              oFormData,
              {
                merge: true,
                groupId: "changes",
              }
            );
          }

          await new Promise((resolve, reject) => {
            oODataModel.submitChanges({
              groupId: "changes",
              success: resolve,
              error: reject,
            });
          });
          oItemsBinding && oItemsBinding.resume();
          oSalesOrderTable.setBusy(false);
          oItemsBinding && oItemsBinding.refresh();

          this._soDialog.close();
          MessageToast.show(
            this._soDialogMode === "create"
              ? "Created Sales Order"
              : "Update Sales Order"
          );
        } catch (error) {
          oItemsBinding && oItemsBinding.resume();
          oSalesOrderTable.setBusy(false);
          MessageBox.error(
            "Save failed.\n" + (e?.responseText || e?.message || "")
          );
        }
      },

      onCancelButtonPress: function () {
        this._soDialog.close();
      },

      onAmountStepInputChange: function () {
        var oSoFormModel = this.getView().getModel("soForm");
        const fNet = Number(oSoFormModel.getProperty("/NetAmount")) || 0;
        const fTax = Number(oSoFormModel.getProperty("/TaxAmount")) || 0;
        oSoFormModel.setProperty(
          "/GrossAmount",
          Number((fNet + fTax).toFixed(2))
        );
      },
    });
  }
);
