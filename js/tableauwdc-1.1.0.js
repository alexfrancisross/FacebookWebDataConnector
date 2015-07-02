(function() {

    var versionNumber = "1.1.0";
    if (typeof tableauVersionBootstrap === 'undefined') {
        // tableau version bootstrap isn't defined. We are likely running in the simulator so init up our tableau object
        tableau = {
            connectionName: "",
            connectionData: "",
            password: "",
            username: "",
            interactive: true,
            incrementalExtractColumn: "",

            initCallback: function () {
                _sendMessage("initCallback");
            },

            shutdownCallback: function () {
                _sendMessage("shutdownCallback");
            },

            submit: function () {
                _sendMessage("submit");
            },

            log: function (msg) {
                _sendMessage("log", {"logMsg": msg});
            },

            headersCallback: function (fieldNames, types) {
                _sendMessage("headersCallback", {"fieldNames": fieldNames, "types":types});
            },

            dataCallback: function (data, lastRecordToken, moreData) {
                _sendMessage("dataCallback", {"data": data, "lastRecordToken": lastRecordToken, "moreData": moreData});
            },

            abortWithError: function (errorMsg) {
                _sendMessage("abortWithError", {"errorMsg": errorMsg});
            }
        };
    } else { // Tableau version bootstrap is defined. Let's use it
        tableauVersionBootstrap.ReportVersionNumber(versionNumber);
    }

    // Check if something weird happened during bootstraping. If so, just define a tableau object to we don't
    // throw errors all over the place because tableau isn't defined
    if (typeof tableau === "undefined") {
        tableau = {}
    }

    tableau.versionNumber = versionNumber;

    // Assign the functions we always want to have available on the tableau object
    tableau.makeConnector = function() {
        var defaultImpls = {
            init: function() { tableau.initCallback(); },
            shutdown: function() { tableau.shutdownCallback(); }
        };
        return defaultImpls;
    };

    tableau.registerConnector = function (wdc) {
        // do some error checking on the wdc
        var functionNames = ["init", "shutdown", "getColumnHeaders", "getTableData"]
        for (var ii = functionNames.length - 1; ii >= 0; ii--) {
            if (typeof(wdc[functionNames[ii]]) !== "function") {
                throw "The connector did not define the required function: " + functionNames[ii];
            }
        };
        window._wdc = wdc;
    };

    function _sendMessage(msgName, msgData) {
        var messagePayload = _buildMessagePayload(msgName, msgData);

        window.parent.postMessage(messagePayload, "*");
    }

    function _buildMessagePayload(msgName, msgData) {
        var msgObj = {"msgName": msgName,
                      "props": _packagePropertyValues(),
                      "msgData": msgData};
        return JSON.stringify(msgObj);
    }

    function _packagePropertyValues() {
        var propValues = {"connectionName": tableau.connectionName,
                          "connectionData": tableau.connectionData,
                          "password": tableau.password,
                          "username": tableau.username,
                          "incrementalExtractColumn": tableau.incrementalExtractColumn};
        return propValues;
    }

    function _applyPropertyValues(props) {
        if (props) {
            tableau.connectionName = props.connectionName;
            tableau.connectionData = props.connectionData;
            tableau.password = props.password;
            tableau.username = props.username;
            tableau.incrementalExtractColumn = props.incrementalExtractColumn;
        }
    }

    function _receiveMessage(event) {
        if (!_wdc) {
            throw "No WDC registered. Did you forget to call tableau.registerConnector?";
        }
        var wdc = _wdc;
        var payloadObj = JSON.parse(event.data);
        var msgData = payloadObj.msgData;
        _applyPropertyValues(payloadObj.props);

        switch(payloadObj.msgName) {
            case "init":
                tableau.interactive = msgData.interactive;
                wdc.init();
            break;
            case "shutdown":
                wdc.shutdown();
            break;
            case "getColumnHeaders":
                wdc.getColumnHeaders();
            break;
            case "getTableData":
                wdc.getTableData(msgData.lastRecordToken);
            break;
        }
    };

    window.addEventListener('message', _receiveMessage, false);
})();