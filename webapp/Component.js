sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/f/library",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
  ],
  function (UIComponent, fioriLibrary, ODataModel, JSONModel) {
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
        this.setModel(new JSONModel({ layout: fioriLibrary.LayoutType.OneColumn }));

        // Router (same as your sample)
        var oRouter = this.getRouter();
        oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);
        oRouter.initialize();
      },
      _onBeforeRouteMatched: function (oEvent) {
        var oModel = this.getModel();
        var mArgs =
          (oEvent.getParameters() && oEvent.getParameters().arguments) || {};
        var sLayout = mArgs.layout;

        if (!sLayout) {
          sLayout = fioriLibrary.LayoutType.OneColumn;
        }
        oModel.setProperty("/layout", sLayout);
      },
    });
  }
);
