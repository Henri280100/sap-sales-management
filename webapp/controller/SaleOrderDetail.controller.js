sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
  "use strict";

  return Controller.extend("sap.ui.smt.controller.SaleOrderDetail", {
    onInit: function () {
      
      this.oRouter = this.getOwnerComponent().getRouter();
      this.oSalesModel = this.getOwnerComponent().getModel("salesOrder");
      this._salesOrderId = null;

      // Cache FCL (from the root view). If this view is not the App view, reach up via owner component.
      this._oFCL =
        this.byId("idFlexibleColumnLayout") ||
        this.getOwnerComponent().getRootControl().byId("idFlexibleColumnLayout");

      // Attach per-route handlers
      this.oRouter
        .getRoute("SaleOrderList")
        .attachPatternMatched(this._onListMatched, this);
      this.oRouter
        .getRoute("detail")
        .attachPatternMatched(this._onDetailMatched, this);
    },

    _onListMatched: function () {
      // Show only the begin (list) column
      this._setLayout("sap.f.LayoutType.OneColumn");

      // Ensure this view is NOT bound to a specific entity when on the list route
      var oView = this.getView();
      if (oView.getElementBinding("salesOrder")) {
        oView.unbindElement("salesOrder"); // <-- pass the model name
      }

      this._salesOrderId = null;
    },

    _onDetailMatched: function (oEvent) {
      // Show list + detail side-by-side
      this._setLayout(fLibarary.LayoutType.TwoColumnsMidExpanded);

      // Bind the detail view to the selected Sales Order
      var sId = oEvent.getParameter("arguments").SalesOrderID;
      if (!sId) {
        return;
      }
      this._salesOrderId = sId;

      var sPath = "/SalesOrderSet('" + sId + "')";
      this.getView().bindElement({
        path: sPath,
        model: "salesOrder",
        parameters: {
          expand: "ToLineItems,ToBusinessPartner", // optional but handy
        },
        events: {
          dataRequested: function () {
            this.getView().setBusy(true);
          }.bind(this),
          dataReceived: function () {
            this.getView().setBusy(false);
          }.bind(this),
        },
      });
    },

    _setLayout: function (sLayout) {
      if (this._oFCL && this._oFCL.getLayout() !== sLayout) {
        this._oFCL.setLayout(sLayout);
      }
    },

    /* ---------- UI actions ---------- */

    onEditToggleButtonPress: function () {
      var oOPL = this.byId("ObjectPageLayout");
      if (!oOPL) return;
      oOPL.setShowFooter(!oOPL.getShowFooter());
    },

    onExit: function () {
      if (!this.oRouter) return;
      this.oRouter
        .getRoute("SaleOrderList")
        .detachPatternMatched(this._onListMatched, this);
      this.oRouter
        .getRoute("detail")
        .detachPatternMatched(this._onDetailMatched, this);
    },
  });
});
