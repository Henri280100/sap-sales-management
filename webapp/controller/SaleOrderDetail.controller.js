sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/smt/model/formatter",
    "sap/ui/core/Fragment",
  ],
  function (Controller, MessageToast, formatter, Fragment) {
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
            
            if (oError && oError.responseText) {
              try {
                const oErr = JSON.parse(oError.responseText);
               
              } catch (e) {
                
              }
            }
            sap.m.MessageBox.error("Failed to execute " + functionName);
          },
        };

        oModel.callFunction(sPath, mParameters);
      },

      onConfirmSOButtonPress: function () {
        this._callFunctionImport("SalesOrder_Confirm");
      },

      onGoodsIssueButtonPress: function () {
        this._callFunctionImport("SalesOrder_GoodsIssueCreated");
      },

      onCreateInvoiceButtonPress: function () {
        this._callFunctionImport("SalesOrder_InvoiceCreated");
      },

      onCancelButtonPress: function () {
        this._callFunctionImport("SalesOrder_Cancel");
      },

      onBusinessPartnerIDLinkPress: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext("salesOrder");
        const oAddress = oContext.getProperty("ToBusinessPartner/Address");

        const fullAddress = `${oAddress.Street} ${oAddress.Building}, ${oAddress.City}, ${oAddress.PostalCode}, ${oAddress.Country}`;

        // Encode the address for URL
        const encodedAddress = encodeURIComponent(fullAddress);

        // Choose map provider from business partner
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        window.open(mapUrl, "_blank");
      },

      handleClose: function () {
        this.oRouter.navTo("SaleOrderList", { layout: "OneColumn" });
      },

      // Product detail
      onColumnListItemPress: function (oEvent) {
        const oSelectedItem = oEvent.getSource();
        const oContext = oSelectedItem.getBindingContext("salesOrder");

        if (!this._pProductDialog) {
          this._pProductDialog = Fragment.load({
            id: "productDetailDialog",
            name: "sap.ui.smt.view.fragment.ProductDetail", // Adjust to your actual namespace
            controller: this,
          }).then(
            function (oDialog) {
              this.getView().addDependent(oDialog);
              return oDialog;
            }.bind(this)
          );
        }

        this._pProductDialog.then(function (oDialog) {
          oDialog.setBindingContext(oContext, "salesOrder");
          oDialog.open();
        });
      },

      onCloseButtonPress: function () {
        if (this._pProductDialog) {
          this._pProductDialog.then(function (oDialog) {
            oDialog.close();
          });
        }
      },
    });
  }
);
