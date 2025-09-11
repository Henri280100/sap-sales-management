sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/core/UIComponent"],
  function (Controller, UIComponent) {
    "use strict";

    return Controller.extend("sap.ui.smt.controller.App", {
      onInit: function () {
        // Safest way to resolve the router for this view/controller
        this.oRouter = UIComponent.getRouterFor(this);

        if (this.oRouter) {
          this._attachRouterHandlers();
        } else {
          // As a fallback, wait until Core is ready, then try again
          sap.ui.getCore().attachInit(
            function () {
              this.oRouter = UIComponent.getRouterFor(this);
              if (this.oRouter) {
                this._attachRouterHandlers();
              }
            }.bind(this)
          );
        }
      },

      _attachRouterHandlers: function () {
        // Attach once; guard against duplicates if onInit runs more than once
        if (this._routerAttached) return;
        this._routerAttached = true;

        this.currentRouteName = null;
        this.currentParams = {};

        this.oRouter.attachRouteMatched(this.onRouteMatched, this);
      },

      onRouteMatched: function (oEvent) {
        this.currentRouteName = oEvent.getParameter("name");
        this.currentParams = oEvent.getParameter("arguments") || {};
      },

      onFlexibleColumnLayoutStateChange: function (oEvent) {
        var bArrow = oEvent.getParameter("isNavigationArrow");
        var sLayout = oEvent.getParameter("layout");
        if (!bArrow || !this.currentRouteName) return;

        var mNav = Object.assign({}, this.currentParams, { layout: sLayout });
        this.oRouter.navTo(this.currentRouteName, mNav, /* bReplace */ true);
      },

      onExit: function () {
        if (this.oRouter) {
          this.oRouter.detachRouteMatched(this.onRouteMatched, this);
        }
      },
    });
  }
);
