sap.ui.define(
  ["sap/ui/core/UIComponent", "sap/f/library", "sap/ui/model/json/JSONModel"],
  function (UIComponent, fioriLibrary, JSONModel) {
    "use strict";

    return UIComponent.extend("sap.ui.smt.Component", {
      metadata: {
        manifest: "json",
      },
      /**
       * @override
       */
      init: function () {
        UIComponent.prototype.init.apply(this, arguments);

        // FCL layout model
        this.setModel(
          new JSONModel({ layout: fioriLibrary.LayoutType.OneColumn })
        );

        var oSO = this.getModel("salesOrder");
        console.log("salesOrder model:", !!oSO, oSO && oSO.sServiceUrl);

        // Router (same as your sample)
        var oRouter = this.getRouter();
        oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);
        oRouter.initialize();
      },
      _onBeforeRouteMatched: function (oEvent) {
        var args =
          (oEvent.getParameters() && oEvent.getParameters().arguments) || {};
        var sLayout =
          args.layout ||
          this.getModel().getProperty("/layout") ||
          fioriLibrary.LayoutType.OneColumn;
        this.getModel().setProperty("/layout", sLayout);
      },
    });
  }
);
