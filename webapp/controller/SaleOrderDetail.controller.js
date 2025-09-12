sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/smt/model/formatter",
  ],
  function (Controller, MessageToast, formatter) {
    "use strict";

    return Controller.extend("sap.ui.smt.controller.SaleOrderDetail", {
      formatter: formatter,
      onInit: function () {
        var oOwnerComponent = this.getOwnerComponent();

        this.oRouter = oOwnerComponent.getRouter();
        this.oModel = oOwnerComponent.getModel("salesOrder"); // named model

        // Attach same handler like the sample (for both routes)
        this.oRouter
          .getRoute("SaleOrderList")
          .attachPatternMatched(this._onSalesOrderMatched, this);
        this.oRouter
          .getRoute("detail")
          .attachPatternMatched(this._onSalesOrderMatched, this);
      },

      _onSalesOrderMatched: function (oEvent) {
        var oArg = oEvent.getParameter("arguments");
        var sPath = this.oModel.createKey("/SalesOrderSet", {
          SalesOrderID: oArg.SalesOrderID,
        });
        console.log("Binding path:", sPath);

        this.oModel
          .metadataLoaded()
          .then(() => {
            this.getView().bindElement({
              path: sPath,
              model: "salesOrder",
              parameters: {
                expand: "ToBusinessPartner,ToLineItems,ToLineItems/ToProduct",
              },
            });
          })
          .catch((err) => {
            console.error("Metadata failed to load", err);
          });
      },

      _callFunctionImport: function (functionName) {
        const salesOrderID = this.getView()
          .getBindingContext("salesOrder")
          .getProperty("SalesOrderID");

        const oModel = this.getView().getModel("salesOrder"); // named model
        const sPath = "/" + functionName;

        const mParameters = {
          method: "POST",
          urlParameters: {
            SalesOrderID: salesOrderID,
          },
          success: function (oData) {
            console.log(functionName + " success:", oData);
            MessageToast.show(functionName + " executed successfully.");
          },
          error: function (oError) {
            console.error(functionName + " error:", oError);
            if (oError && oError.responseText) {
              try {
                const oErr = JSON.parse(oError.responseText);
                console.error("Response body:", oErr);
              } catch (e) {
                console.error(
                  "Cannot parse responseText:",
                  oError.responseText
                );
              }
            }
            sap.m.MessageBox.error("Failed to execute " + functionName);
          },
        };

        oModel.callFunction(sPath, mParameters);
      },

      onConfirmSO: function () {
        this._callFunctionImport("SalesOrder_Confirm");
      },

      onGoodsIssue: function () {
        this._callFunctionImport("SalesOrder_GoodsIssueCreated");
      },

      onCreateInvoice: function () {
        this._callFunctionImport("SalesOrder_InvoiceCreated");
      },

      onCancel: function () {
        this._callFunctionImport("SalesOrder_Cancel");
      },

      onBusinessPartnerPress: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext("salesOrder");
        const oAddress = oContext.getProperty("ToBusinessPartner/Address");

        const fullAddress = `${oAddress.Street} ${oAddress.Building}, ${oAddress.City}, ${oAddress.PostalCode}, ${oAddress.Country}`;

        // Encode the address for URL
        const encodedAddress = encodeURIComponent(fullAddress);

        // Choose map provider from business partner
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        //  maybe later
        // const mapUrl = `https://wego.here.com/search/${encodedAddress}`;

        window.open(mapUrl, "_blank");
      },
    });
  }
);
