sap.ui.define(
  ["sap/ui/model/Sorter", "sap/ui/model/FilterType"],
  function (Sorter, FilterType) {
    "use strict";

    function _getBinding(oTable) {
      return oTable && oTable.getBinding && oTable.getBinding("items");
    }

    function _setOperationMode(oTable, sMode) {
      var b = _getBinding(oTable);
      if (!b || !b.changeParameters) {
        return;
      }
      if (b.suspend && !b.isSuspended?.()) {
        b.suspend();
      }
      b.changeParameters({ operationMode: sMode });
      if (b.resume) {
        b.resume();
      }
    }

    function _clearAllSorters(oTable) {
      var b = _getBinding(oTable);
      if (b && b.sort) {
        b.sort([]);
      }
    }

    // recompute map: { DeliveryStatusCode -> count } from current binding data
    function _rebuildDeliveryCountsFromBinding(oTable) {
      var b = _getBinding(oTable);
      var m = Object.create(null);
      if (!b) {
        return m;
      }

      var len = b.getLength?.() || 0;
      var ctxs =
        (b.getCurrentContexts
          ? b.getCurrentContexts()
          : b.getContexts(0, len)) || [];
      for (var i = 0; i < ctxs.length; i++) {
        var o = ctxs[i].getObject && ctxs[i].getObject();
        if (!o) {
          continue;
        }
        var k = o.DeliveryStatus || "Initial";
        m[k] = (m[k] || 0) + 1;
      }
      return m;
    }

    function setupClientGrouping(oTable) {
      var b = _getBinding(oTable);
      if (!b) {
        return;
      }

      // ensure client mode & no server sorters
      _setOperationMode(oTable, "Client");
      _clearAllSorters(oTable);

      // group by DeliveryStatus on the client
      var oGroupSorter = new Sorter("DeliveryStatus", false, function (oCtx) {
        var code = oCtx.getProperty("DeliveryStatus") || "Initial";
        var text = oCtx.getProperty("DeliveryStatusDescription") || code;

        // recompute visible counts for headers (client data only)
        var counts = _rebuildDeliveryCountsFromBinding(oTable);
        var count = counts[code] || 0;

        return { key: code, text: text + " (" + count + ")" };
      });

      var oBySO = new Sorter("SalesOrderID", false);
      b.sort([oGroupSorter, oBySO]); // client-side only; no $orderby sent
    }

    function applyDefaultDeliveryGroupingClient(oTable) {
      // alias that ensures client mode & applies group + secondary sort
      setupClientGrouping(oTable);
    }

    function resetVhdTableFilters(oVHD, oBasicSearchField) {
      if (!oVHD) {
        return;
      }

      // clear basic search
      if (oBasicSearchField && oBasicSearchField.setValue) {
        oBasicSearchField.setValue("");
      }

      var oFilterBar = oVHD.getFilterBar && oVHD.getFilterBar();
      if (oFilterBar && oFilterBar.search) {
        oFilterBar.search(); // will trigger filter([]) in your handler
      }

      // also clear the inner table binding explicitly
      if (oVHD.getTableAsync) {
        oVHD.getTableAsync().then(function (oTable) {
          var sAgg = oTable.bindRows ? "rows" : "items";
          var oBinding = oTable.getBinding(sAgg);
          if (oBinding && oBinding.filter) {
            oBinding.filter([], FilterType.Application);
          }
          oVHD.update && oVHD.update();
        });
      }
    }

    return {
      // public helpers
      getMainBinding: _getBinding,
      setOperationMode: _setOperationMode,
      clearAllSorters: _clearAllSorters,

      setupClientGrouping: setupClientGrouping,
      applyDefaultDeliveryGroupingClient: applyDefaultDeliveryGroupingClient,

      resetVhdTableFilters: resetVhdTableFilters,
    };
  }
);
