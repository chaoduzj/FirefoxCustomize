// ==UserScript==
// @name           SidebarModoki
// @namespace      http://space.geocities.yahoo.co.jp/gl/alice0775
// @description    TST
// @include        main
// @compatibility  Firefox 106
// @author         Alice0775
// @note           Tree Style Tab がある場合にブックマークと履歴等を別途"サイドバーもどき"で表示
// @note           SidebarModoki.uc.js.css をuserChrome.cssに読み込ませる必要あり
// @version        2022/09/29 fix Bug 1689816 
// @version        2022/09/28 ordinal position
// @version        2022/09/14 fix Bug 1790299
// @version        2022/09/14 use toolbarspring instead of spacer
// @version        2022/08/26 Bug 1695435 - Remove @@hasInstance for IDL interfaces in chrome context
// @version        2022/04/01 23:00 Convert Components.utils.import to ChromeUtils.import
// @version        2022/03/26 23:00 Bug 1760342 - Remove :-moz-lwtheme-{brighttext,darktext}
// @version        2021/11/21 18:00 Bug 1742111 - Rename internal accentcolor and textcolor properties to be more consistent with the webext theme API
// @version        2021/11/14 13:00 wip change css(Bug 1740230 - moz-lwtheme* pseudo-classes don't get invalidated correctly)
// @version        2021/09/30 22:00 change splitter color
// @version        2021/05/18 20:00 fix margin of tabpanels
// @version        2021/02/09 20:00 Rewrite `X.setAttribute("hidden", Y)` to `X.hidden = Y`
// @version        2020/06/18 fix SidebarModoki position(Bug 1603830 - Remove support for XULElement.ordinal)
// @version        2019/12/11 fix for 73 Bug 1601094 - Rename remaining .xul files to .xhtml in browser
// @version        2019/11/14 03:00 workarround Ctrl+tab/Ctrl+pageUP/Down
// @version        2019/10/20 22:00 fix surplus loading
// @version        2019/10/20 12:30 workaround Bug 1497200: Apply Meta CSP to about:downloads, Bug 1513325 - Remove textbox binding
// @version        2019/09/05 13:00 fix listitem
// @version        2019/08/07 15:00 fix adding key(renamde from key to keyvalue in jsonToDOM)
// @version        2019/07/13 13:00 fix wrong commit
// @version        2019/07/10 10:00 fix 70 Bug 1558914 - Disable Array generics in Nightly
// @version        2019/05/29 16:00 Bug 1519514 - Convert tab bindings
// @version        2018/12/23 14:00 Adjust margin
// @version        2018/12/23 00:00 Add option of SidebarModoki posiotion SM_RIGHT
// @version        2018/05/10 00:00 for 61 wip Bug 1448810 - Rename the Places sidebar files
// @version        2018/05/08 21:00 use jsonToDOM(https://developer.mozilla.org/en-US/docs/Archive/Add-ons/Overlay_Extensions/XUL_School/DOM_Building_and_HTML_Insertion)
// @version        2018/05/08 19:00 get rid loadoverlay
// @version        2017/11/24 19:50 do nothing if window is popup(window.open)
// @version        2017/11/24 19:20 change close button icon style to 57
// @version        2017/11/24 19:10 add key(accel(ctrl)+alt+s) and close button
// @version        2017/11/24 19:00 hack for DL manager
// @version        2017/11/24 15:00 remove unused variable
// @version        2017/11/23 13:10 restore initial tab index/width and more unique id
// @version        2017/11/23 12:30 try catch.  download manager
// @version        2017/11/23 00:30 Make button icon
// @version        2017/11/23 00:00 Make button customizable
// @version        2017/11/22 23:00 fullscreen
// @version        2017/11/22 23:00 DOM fullscreen
// @version        2017/11/22 22:00 F11 fullscreen
// @version        2017/11/15 09:00
// ==/UserScript==

var SidebarModoki = {
  // -- config --
  // SM_RIGHT: false,  // SidebarModoki position
  get SM_RIGHT() {
    return this.getPref("sidebar.position_start", "bool", false);
  },
  SM_WIDTH: 130,
  SM_AUTOHIDE: false,  //F11 Fullscreen
  TABS: [{
    src: "chrome://browser/content/places/bookmarksSidebar.xhtml",
    "data-l10n-id": "library-bookmarks-menu",
  }, {
    src: "chrome://browser/content/places/historySidebar.xhtml",
    "data-l10n-id": "appmenuitem-history",
  }, {
    src: "chrome://browser/content/downloads/contentAreaDownloadsView.xhtml?SM",
    "data-l10n-id": "appmenuitem-downloads",
  }, {
    hidden: async function () {
      let tst = await AddonManager.getAddonByID("treestyletab@piro.sakura.ne.jp");
      return !tst?.isActive;
    },
    src: async function () {
      let tst = await AddonManager.getAddonByID("treestyletab@piro.sakura.ne.jp");
      if (tst && tst.isActive) {
        return tst.optionsURL.replace("options/options.html", "sidebar/sidebar.html");
      } else {
        return "";
      }
    },
    label: "TST"
  }],
  // -- config --

  kSM_Open: "userChrome.SidebarModoki.Open",
  kSM_lastSelectedTabIndex: "userChrome.SidebarModoki.lastSelectedTabIndex",
  kSM_lastSelectedTabWidth: "userChrome.SidebarModoki.lastSelectedTabWidth",
  ToolBox: null,
  Button: null,

  get prefs() {
    delete this.prefs;
    return this.prefs = Services.prefs;
  },

  jsonToDOM: function (jsonTemplate, doc, nodes) {
    jsonToDOM.namespaces = {
      html: "http://www.w3.org/1999/xhtml",
      xul: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
    };
    jsonToDOM.defaultNamespace = jsonToDOM.namespaces.xul;
    function jsonToDOM(jsonTemplate, doc, nodes) {
      function namespace(name) {
        var reElemNameParts = /^(?:(.*):)?(.*)$/.exec(name);
        return { namespace: jsonToDOM.namespaces[reElemNameParts[1]], shortName: reElemNameParts[2] };
      }

      // Note that 'elemNameOrArray' is: either the full element name (eg. [html:]div) or an array of elements in JSON notation
      function tag(elemNameOrArray, elemAttr) {
        // Array of elements?  Parse each one...
        if (Array.isArray(elemNameOrArray)) {
          var frag = doc.createDocumentFragment();
          Array.prototype.forEach.call(arguments, function (thisElem) {
            frag.appendChild(tag.apply(null, thisElem));
          });
          return frag;
        }

        // Single element? Parse element namespace prefix (if none exists, default to defaultNamespace), and create element
        var elemNs = namespace(elemNameOrArray);
        var elem = doc.createElementNS(elemNs.namespace || jsonToDOM.defaultNamespace, elemNs.shortName);

        // Set element's attributes and/or callback functions (eg. onclick)
        for (var key in elemAttr) {
          var val = elemAttr[key];
          if (nodes && key == "keyvalue") {  //for later convenient JavaScript access) by giving them a 'keyvalue' attribute; |nodes|.|keyvalue|
            nodes[val] = elem;
            continue;
          }

          var attrNs = namespace(key);
          if (typeof val == "function") {
            // Special case for function attributes; don't just add them as 'on...' attributes, but as events, using addEventListener
            elem.addEventListener(key.replace(/^on/, ""), val, false);
          } else {
            // Note that the default namespace for XML attributes is, and should be, blank (ie. they're not in any namespace)
            elem.setAttributeNS(attrNs.namespace || "", attrNs.shortName, val);
          }
        }

        // Create and append this element's children
        var childElems = Array.prototype.slice.call(arguments, 2);
        childElems.forEach(function (childElem) {
          if (childElem != null) {
            elem.appendChild(
              doc.defaultView.Node.isInstance(childElem)
                /*childElem instanceof doc.defaultView.Node*/ ? childElem :
                Array.isArray(childElem) ? tag.apply(null, childElem) :
                  doc.createTextNode(childElem));
          }
        });
        return elem;
      }
      return tag.apply(null, jsonTemplate);
    }

    return jsonToDOM(jsonTemplate, doc, nodes);
  },

  init: async function () {
    let chromehidden = document.getElementById("main-window").hasAttribute("chromehidden");
    if (chromehidden &&
      document.getElementById("main-window").getAttribute("chromehidden").includes("extrachrome")) {
      return; // do nothing
    }

    // let MARGINHACK = this.SM_RIGHT ? "0 0 0 0" : "0 -2px 0 0";
    let MARGINHACK = "0 0 0 0";
    let style = `
      @namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);
      #appcontent {
        -moz-box-ordinal-group: 4 !important;
      }
      #SM_toolbox
      {
        width: {SM_WIDTH}px;
        background-color: var(--toolbar-bgcolor);
        color: -moz-dialogtext;
        text-shadow: none;
      }
      #SM_toolbox[position="left"] {
        -moz-box-ordinal-group: 10 !important;
      }
      #SM_toolbox:-moz-lwtheme {
        /*background-color: var(--lwt-accent-color);*/
        background-color: var(--toolbar-bgcolor);
        color: var(--lwt-text-color);
      }
      .SM_toolbarspring {
          max-width: unset !important;
      }
      /*visibility*/
      #SM_toolbox[collapsed],
      #SM_splitter[collapsed],
      /*フルスクリーン*/
      #SM_toolbox[moz-collapsed="true"],
      #SM_splitter[moz-collapsed="true"]
      {
        visibility:collapse;
      }
      #SM_splitter {
        background-color: var(--toolbar-bgcolor) !important;
        border-inline-start-color: var(--toolbar-bgcolor) !important;
        border-inline-end-color: var(--toolbar-bgcolor) !important;
        min-width: 2px;
      }
      /*ポップアップの時*/
      #main-window[chromehidden~="extrachrome"] #SM_toolbox,
      #main-window[chromehidden~="extrachrome"] #SM_splitter
      {
        visibility: collapse;
      }
      #SM_tabpanels
      { 
        appearance: none !important;
        padding: 0 !important;
        margin: {MARGINHACK}; /*hack*/
        appearance: unset;
        color-scheme: unset !important;
        flex: 1 1 100%;
      }
      #SM_header {
        background-color: var(--toolbar-field-background-color, var(--toolbar-bgcolor));
        padding: 6px !important;
        border-bottom: 0px solid transparent !important;
        color: inherit !important;
        font-size: 1.2em !important;
        color: var(--toolbar-color);
      }
      toolbar[brighttext]:-moz-lwtheme #SM_tabbox {
        background-color: var(--toolbar-bgcolor);
      }
      #SM_tabbox {
        display: flex;
      }
      #SM_toolbox[position="left"] #SM_tabbox{
        flex-direction: row-reverse;
      }
      #SM_tabs {
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        width: calc(2 * 2px + 16px + 2 * var(--toolbarbutton-inner-padding));
        height: auto;
        justify-content: flex-start;
        align-items: center;
        flex-shrink: 0;
        padding: 0 2px;
      }
      #SM_tabs tab {
        appearance: none !important;
        padding: 0 !important;
        margin: 0 !important;
        margin-top: 4px;
        color: unset !important;
      }
      #SM_tabs tab:not([selected]) {
        opacity: 0.6 !important;
      }
      #SM_tabs tab > hbox {
        padding: var(--toolbarbutton-inner-padding) !important;
        border-radius: var(--toolbarbutton-border-radius) !important;
        height: calc(16px + 2* var(--toolbarbutton-inner-padding));
        width: calc(16px + 2* var(--toolbarbutton-inner-padding));
        outline: none !important;
      }
      #SM_Button
      {
        list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQ0lEQVQ4jWNgoAL4z8DA8N/AwAArTQRGFSBBI4YBDHhonC6n3AA1NTUMZ6F5gyQXYFNEsheweWnUBfRyAbmYcgMoAgBFX4a/wlDliwAAAABJRU5ErkJggg==');
      }
      toolbar[brighttext]:-moz-lwtheme #SM_Button
      {
        list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANklEQVQ4jWP4TyFg+P///38GBgayMHUNwEdjdTrVDcDnTKJdgEsRSV5ACaBRF9DZBQObFygBAMeIxVdCQIJTAAAAAElFTkSuQmCC');
      }
      #SM_tabs tab > hbox[visuallyselected="true"] {
          background-color: var(--toolbarbutton-active-background);
      }
      #SM_tabs tab > hbox > label {
          visibility: collapse;
      }
      #SM_tabs tab > hbox > image {
          width: 16px;
          height: 16px;
      }
      #SM_tabs [data-l10n-id="library-bookmarks-menu"] {
        list-style-image: url("chrome://browser/skin/bookmark-star-on-tray.svg");

      }
      #SM_tabs [data-l10n-id="appmenuitem-history"] {
          list-style-image: url("chrome://browser/skin/history.svg");
      }
      #SM_tabs [data-l10n-id="appmenuitem-downloads"] {
          list-style-image: url("chrome://browser/skin/downloads/downloads.svg");
      }
      #SM_tabs [label="TST"] {
          list-style-image: url("data:image/svg+xml;base64,PCEtLSBUaGlzIFNvdXJjZSBDb2RlIEZvcm0gaXMgc3ViamVjdCB0byB0aGUgdGVybXMgb2YgdGhlIE1vemlsbGEgUHVibGljDQogICAtIExpY2Vuc2UsIHYuIDIuMC4gSWYgYSBjb3B5IG9mIHRoZSBNUEwgd2FzIG5vdCBkaXN0cmlidXRlZCB3aXRoIHRoaXMNCiAgIC0gZmlsZSwgWW91IGNhbiBvYnRhaW4gb25lIGF0IGh0dHA6Ly9tb3ppbGxhLm9yZy9NUEwvMi4wLy4gLS0+DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMzIgMzIiPg0KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE0LjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgNDMzNjMpICAtLT4NCjxzdHlsZT4NCglnOnRhcmdldCB7DQoJCWZpbGwtcnVsZTogZXZlbm9kZDsNCgl9DQoJZy50aGVtZTp0YXJnZXQgew0KCQlmaWxsOiBoc2woMCwgMCUsIDAlKTsNCgl9DQoJZy5icmlnaHQ6dGFyZ2V0IHsNCgkJZmlsbDogIzBDMEMwRDsNCgl9DQoJZy5kYXJrOnRhcmdldCB7DQoJCWZpbGw6ICNGOUY5RkE7DQoJfQ0KCWcubWFzazp0YXJnZXQgew0KCQlmaWxsOiBibGFjazsNCgl9DQoJZzpub3QoLm1hc2spOm5vdCg6dGFyZ2V0KSwNCglnOnRhcmdldCB+IGcubWFzayB7DQoJCWRpc3BsYXk6IG5vbmU7DQoJfQ0KPC9zdHlsZT4NCjxzeW1ib2wgaWQ9Imljb24iPg0KCTxwYXRoIGQ9Ik0yNiwySDZDMy44LDIsMiwzLjgsMiw2djIwYzAsMi4yLDEuOCw0LDQsNGgyMGMyLjIsMCw0LTEuOCw0LTRWNkMzMCwzLjgsMjguMiwyLDI2LDJ6IE0xMiwyMCAgIGMtMC41NTIsMC0xLTAuNDQ3LTEtMXYtNmwxNiwwdjdIMTJ6IE01LDZjMC0wLjU0MiwwLjQ1OC0xLDEtMWgyMGMwLjU0MiwwLDEsMC40NTgsMSwxdjYuMDEybC0yMSwwVjEyYy0wLjU1MiwwLTEtMC40NDgtMS0xVjZ6ICAgIE0yNiwyN2gtOGMtMC41NTMsMC0xLTAuNDQ3LTEtMXYtNS4wMTNoMTBWMjZDMjcsMjYuNTQyLDI2LjU0MiwyNywyNiwyN3oiLz4NCgk8cGF0aCBkPSJNMTAsOC41QzEwLDkuMzI1LDkuMzI1LDEwLDguNSwxMFM3LDkuMzI1LDcsOC41UzcuNjc1LDcsOC41LDdTMTAsNy42NzUsMTAsOC41eiIvPg0KCTxwYXRoIGQ9Ik0xNiwxNi41YzAsMC44MjUtMC42NzUsMS41LTEuNSwxLjVTMTMsMTcuMzI1LDEzLDE2LjVzMC42NzUtMS41LDEuNS0xLjVTMTYsMTUuNjc1LDE2LDE2LjV6Ii8+DQoJPHBhdGggZD0iTTIyLDIzLjVjMCwwLjgyNS0wLjY3NSwxLjUtMS41LDEuNVMxOSwyNC4zMjUsMTksMjMuNXMwLjY3NS0xLjUsMS41LTEuNVMyMiwyMi42NzUsMjIsMjMuNXoiLz4NCjwvc3ltYm9sPg0KPGcgaWQ9InRvb2xiYXItdGhlbWUiIGNsYXNzPSJ0aGVtZSIgZmlsbC1vcGFjaXR5PSIwLjgiPg0KCTx1c2UgaHJlZj0iI2ljb24iLz4NCjwvZz4NCjxnIGlkPSJkZWZhdWx0LXRoZW1lIiBjbGFzcz0idGhlbWUiIGZpbGwtb3BhY2l0eT0iMSI+DQoJPHVzZSBocmVmPSIjaWNvbiIvPg0KPC9nPg0KPGcgaWQ9InRvb2xiYXItYnJpZ2h0IiBjbGFzcz0iYnJpZ2h0IiBmaWxsLW9wYWNpdHk9IjAuOCI+DQoJPHVzZSBocmVmPSIjaWNvbiIvPg0KPC9nPg0KPGcgaWQ9ImRlZmF1bHQtYnJpZ2h0IiBjbGFzcz0iYnJpZ2h0IiBmaWxsLW9wYWNpdHk9IjEiPg0KCTx1c2UgaHJlZj0iI2ljb24iLz4NCjwvZz4NCjxnIGlkPSJ0b29sYmFyLWRhcmsiIGNsYXNzPSJkYXJrIiBmaWxsLW9wYWNpdHk9IjAuOCI+DQoJPHVzZSBocmVmPSIjaWNvbiIvPg0KPC9nPg0KPGcgaWQ9ImRlZmF1bHQtZGFyayIgY2xhc3M9ImRhcmsiIGZpbGwtb3BhY2l0eT0iMSI+DQoJPHVzZSBocmVmPSIjaWNvbiIvPg0KPC9nPg0KPGcgaWQ9Im1hc2siIGNsYXNzPSJtYXNrIiBmaWxsLW9wYWNpdHk9IjEiPg0KCTx1c2UgaHJlZj0iI2ljb24iLz4NCjwvZz4NCjwvc3ZnPg==");
      }
     `;
    var sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
    var uri = makeURI('data:text/css;charset=UTF=8,' + encodeURIComponent(style.replace(/\s+/g, " ").replace(/\{SM_WIDTH\}/g, this.SM_WIDTH).replace(/\{MARGINHACK\}/g, MARGINHACK)));
    if (!sss.sheetRegistered(uri, sss.AGENT_SHEET))
      sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
    /*
        style = style.replace(/\s+/g, " ").replace(/\{SM_WIDTH\}/g, this.SM_WIDTH).replace(/\{MARGINHACK\}/g, MARGINHACK);
        let sspi = document.createProcessingInstruction(
          'xml-stylesheet',
          'type="text/css" href="data:text/css,' + encodeURIComponent(style) + '"'
        );
        document.insertBefore(sspi, document.documentElement);
        sspi.getAttribute = function(name) {
          return document.documentElement.getAttribute(name);
        };
    */
    ChromeUtils.import("resource:///modules/CustomizableUI.jsm");
    // xxxx try-catch may need for 2nd window
    try {
      CustomizableUI.createWidget({ //must run createWidget before windowListener.register because the register function needs the button added first
        id: 'SM_Button',
        type: 'custom',
        defaultArea: CustomizableUI.AREA_NAVBAR,
        onBuild: function (aDocument) {
          var toolbaritem = aDocument.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'toolbarbutton');
          var props = {
            id: "SM_Button",
            class: "toolbarbutton-1 chromeclass-toolbar-additional",
            tooltiptext: "Sidebar Modoki",
            oncommand: "SidebarModoki.toggle();",
            type: "button",
            label: "Sidebar Modoki",
            removable: "true"
          };
          for (var p in props) {
            toolbaritem.setAttribute(p, props[p]);
          }

          return toolbaritem;
        }
      });
    } catch (e) { }

    // to do, replace with MozXULElement.parseXULToFragment();
    let template = ["command", { id: "cmd_SidebarModoki", oncommand: "SidebarModoki.toggle()" }];
    document.getElementById("mainCommandSet").appendChild(this.jsonToDOM(template, document, {}));

    template = ["key", { id: "key_SidebarModoki", key: "B", modifiers: "accel,alt", command: "cmd_SidebarModoki", }];
    document.getElementById("mainKeyset").appendChild(this.jsonToDOM(template, document, {}));
    //to do xxx ordinal=xx shoud be replaced with style="-moz-box-ordinal-group: xx;"
    template =
      ["vbox", { id: "SM_toolbox", position: this.SM_RIGHT ? "left" : "right" },
        ["hbox", { id: "SM_header", align: "center" },
          ["label", {}, "SidebarModoki"],
          ["toolbarspring", { class: "SM_toolbarspring", flex: "1000" }],
          ["toolbarbutton", { id: "SM_closeButton", class: "close-icon tabbable", tooltiptext: "Close SidebarModoki", oncommand: "SidebarModoki.close();" }]
        ],
        ["tabbox", { id: "SM_tabbox", flex: "1", handleCtrlPageUpDown: false, handleCtrlTab: false },
          ["tabs", { id: "SM_tabs" },
          ],
          ["tabpanels", { id: "SM_tabpanels", flex: "1", style: "border: none;" },
          ]
        ]
      ];
    funcName = ["hidden", "src"];
    for (let i = 0; i < this.TABS.length; i++) {
      let tab = Object.assign(this.TABS[i], { id: "SM_tab" + i });
      for (let i in funcName) {
        let attr = funcName[i];
        if (tab.hasOwnProperty(attr)) {
          let val = tab[attr];
          if (typeof val === "function") {
            val = val();
            if (isPromise(val)) val = await Promise.resolve(val);
            tab[attr] = val;
          }
        }
      }
      // if (tab.hasOwnProperty("hidden")) {
      //   if (typeof tab.isEnabled === "function" && await tab.isEnabled()) {
      //     if (tab.src) {
      //       delete tab.isEnabled;
      //     } else if (typeof tab.getSrc === "function") {
      //       let src = tab.getSrc();
      //       if (isPromise(src)) src = await Promise.resolve(src);
      //       tab.src = src;
      //       delete tab.isEnabled;
      //       delete tab.getSrc;
      //     } else {
      //       continue;
      //     }
      //   }
      // }
      template[3][2].push(["tab", tab]);
      let browser = { id: "SM_tab" + i + "-browser", flex: "1", autoscroll: "false", src: "" };
      if (tab.src.startsWith("moz")) {
        browser.messagemanagergroup = "webext-browsers";
        browser.disableglobalhistory = true;
        browser["webextension-view-type"] = "sidebar";
        browser.type = "content";
        browser.remote = true;
        browser.maychangeremoteness = "true";
        browser.disablefullscreen = "true"
      }
      template[3][3].push(["tabpanel", { id: "SM_tab" + i + "-container", orient: "vertical", flex: "1" }, ["browser", browser]]);

    }
    let sidebar = document.getElementById("sidebar-box");
    sidebar.parentNode.insertBefore(this.jsonToDOM(template, document, {}), sidebar);

    template =
      ["splitter", { id: "SM_splitter", style: this.SM_RIGHT ? "-moz-box-ordinal-group:9" : "-moz-box-ordinal-group:2", state: "open", collapse: this.SM_RIGHT ? "after" : "before", resizebefore: "closest", resizeafter: "farthest" },
        ["grippy", {}]
      ];
    sidebar.parentNode.insertBefore(this.jsonToDOM(template, document, {}), sidebar);

    //xxx 69 hack
    let tabbox = document.getElementById("SM_tabbox");
    tabbox.handleEvent = function handleEvent(event) {
      if (!event.isTrusted) {
        // Don't let untrusted events mess with tabs.
        return;
      }

      // Skip this only if something has explicitly cancelled it.
      if (event.defaultCancelled) {
        return;
      }

      // Don't check if the event was already consumed because tab
      // navigation should always work for better user experience.
      let imports = {};
      ChromeUtils.defineModuleGetter(
        imports,
        "ShortcutUtils",
        "resource://gre/modules/ShortcutUtils.jsm"
      );
      const { ShortcutUtils } = imports;

      switch (ShortcutUtils.getSystemActionForEvent(event)) {
        case ShortcutUtils.CYCLE_TABS:
          if (this.tabs && this.handleCtrlTab) {
            this.tabs.advanceSelectedTab(event.shiftKey ? -1 : 1, true);
            event.preventDefault();
          }
          break;
        case ShortcutUtils.PREVIOUS_TAB:
          if (this.tabs && this.handleCtrlPageUpDown) {
            this.tabs.advanceSelectedTab(-1, true);
            event.preventDefault();
          }
          break;
        case ShortcutUtils.NEXT_TAB:
          if (this.tabs && this.handleCtrlPageUpDown) {
            this.tabs.advanceSelectedTab(1, true);
            event.preventDefault();
          }
          break;
      }
    };

    let index = document.getElementById("SM_tabpanels").selectedIndex;
    let tb0 = document.getElementById("SM_tab0");
    let tb1 = document.getElementById("SM_tab1");
    let tb2 = document.getElementById("SM_tab2");
    tb0.parentNode.insertBefore(tb0, tb1);
    tb0.parentNode.insertBefore(tb1, tb2);
    document.getElementById("SM_tabs").selectedIndex = index;

    setTimeout(function () { this.observe(); }.bind(this), 0);

    //F11 fullscreen
    FullScreen.showNavToolbox_org = FullScreen.showNavToolbox;
    FullScreen.showNavToolbox = function (trackMouse = true) {
      FullScreen.showNavToolbox_org(trackMouse);
      if (!!SidebarModoki.ToolBox) {
        SidebarModoki.ToolBox.removeAttribute("moz-collapsed");
        SidebarModoki.Splitter.removeAttribute("moz-collapsed");
      }
    }
    FullScreen.hideNavToolbox_org = FullScreen.hideNavToolbox;
    FullScreen.hideNavToolbox = function (aAnimate = false) {
      FullScreen.hideNavToolbox_org(aAnimate);
      if (SidebarModoki.SM_AUTOHIDE && !!SidebarModoki.ToolBox) {
        SidebarModoki.ToolBox.setAttribute("moz-collapsed", "true");
        SidebarModoki.Splitter.setAttribute("moz-collapsed", "true");
      }
    }

    //DOM fullscreen
    window.addEventListener("MozDOMFullscreen:Entered", this,
                            /* useCapture */ true,
                            /* wantsUntrusted */ false);
    window.addEventListener("MozDOMFullscreen:Exited", this,
                            /* useCapture */ true,
                            /* wantsUntrusted */ false);

    /*
        SidebarUI.setPosition_org = SidebarUI.setPosition;
        SidebarUI.setPosition = function() {
          SidebarUI.setPosition_org();
          if (SidebarModoki && SidebarModoki.ToolBox) 
          SidebarModoki.ToolBox.style.setProperty("-moz-box-ordinal-group", SidebarModoki.SM_RIGHT ? "10" : "0", "");
          if (SidebarModoki && SidebarModoki.Splitter) 
          SidebarModoki.Splitter.style.setProperty("-moz-box-ordinal-group", SidebarModoki.SM_RIGHT ? "9" : "0", "");
        };
    */
    function isDef(v) {
      return v !== undefined && v !== null
    }

    function isPromise(val) {
      return (
        isDef(val) &&
        typeof val.then === 'function' &&
        typeof val.catch === 'function'
      )
    }
  },


  observe: function () {
    this.ToolBox = document.getElementById("SM_toolbox");
    this.Splitter = document.getElementById("SM_splitter");
    this.ToolBox.setAttribute("position", this.SM_RIGHT ? "left" : "right")
    // this.ToolBox.style.setProperty("-moz-box-ordinal-group", this.SM_RIGHT ? "10" : "0", "");
    this.Splitter.style.setProperty("-moz-box-ordinal-group", this.SM_RIGHT ? "9" : "2", "");

    if (this.getPref(this.kSM_Open, "bool", true)) {
      this.toggle(true);
    } else {
      this.close();
    }
    document.getElementById("SM_tabs").addEventListener("focus", this, true);
    window.addEventListener("aftercustomization", this, false);

    // xxxx native sidebar changes ordinal when change position of the native sidebar and open/close
    this.SM_Observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        switch (mutation.attributeName) {
          case "collapsed":
          case "hidden":
          case "positionend":
            setTimeout(() => {
              this.Splitter = document.getElementById("SM_splitter");
              this.ToolBox.setAttribute("position", this.SM_RIGHT ? "left" : "right")
              // this.ToolBox.style.setProperty("-moz-box-ordinal-group", this.SM_RIGHT ? "10" : "0", "");
              this.Splitter.style.setProperty("-moz-box-ordinal-group", this.SM_RIGHT ? "9" : "2", "");
            }, 0);
            break;
        }
      }.bind(this));
    }.bind(this));
    // pass in the target node, as well as the observer options
    this.SM_Observer.observe(document.getElementById("sidebar-box"),
      { attribute: true, attributeFilter: ["collapsed", "hidden", "positionend"] });
  },

  onSelect: function (event) {
    let aIndex = document.getElementById("SM_tabpanels").selectedIndex;
    this.prefs.setIntPref(this.kSM_lastSelectedTabIndex, aIndex);
    width = this.getPref(this.kSM_lastSelectedTabWidth + aIndex, "int", this.SM_WIDTH);
    if (document.getElementById("SM_tab" + aIndex + "-browser").src == "") {
      document.getElementById("SM_tab" + aIndex + "-browser").src = this.TABS[aIndex].src;
    }
    document.getElementById("SM_toolbox").style.setProperty("width", width + "px", "");
  },

  toggle: function (forceopen) {
    this.Button = document.getElementById("SM_Button");
    if (!this.Button.hasAttribute("checked") || forceopen) {
      this.Button.setAttribute("checked", true);
      this.ToolBox.collapsed = false;
      this.Splitter.collapsed = false;
      let index = this.getPref(this.kSM_lastSelectedTabIndex, "int", 0);
      document.getElementById("SM_tabs").selectedIndex = index;
      width = this.getPref(this.kSM_lastSelectedTabWidth + index, "int", this.SM_WIDTH);
      document.getElementById("SM_toolbox").style.setProperty("width", width + "px", "");
      this.prefs.setBoolPref(this.kSM_Open, true)
      this.onSelect({});
      addEventListener("resize", this, false);
    } else {
      this.close();
    }
  },

  close: function () {
    removeEventListener("resize", this, false);
    this.Button = document.getElementById("SM_Button");
    this.Button.removeAttribute("checked");
    this.ToolBox.collapsed = true;
    this.Splitter.collapsed = true;
    this.prefs.setBoolPref(this.kSM_Open, false)
  },


  //ここからは, 大きさの調整
  onResize: function (event) {
    let width = this.ToolBox.getBoundingClientRect().width;
    let aIndex = document.getElementById("SM_tabs").selectedIndex;
    this.prefs.setIntPref(this.kSM_lastSelectedTabWidth + aIndex, width);
  },

  handleEvent: function (event) {
    switch (event.type) {
      case 'focus':
        this.onSelect(event);
        break;
      case 'resize':
        this.onResize(event);
        break;
      case 'MozDOMFullscreen:Entered':
        if (!!this.ToolBox) {
          this.ToolBox.setAttribute("moz-collapsed", "true");
          this.Splitter.setAttribute("moz-collapsed", "true");
        }
        break;
      case 'MozDOMFullscreen:Exited':
        if (!!this.ToolBox) {
          this.ToolBox.removeAttribute("moz-collapsed");
          this.Splitter.removeAttribute("moz-collapsed");
        }
        break;
      case 'aftercustomization':
        if (this.getPref(this.kSM_Open, "bool", true)) {
          this.Button.setAttribute("checked", true);
        }
        break;
    }
  },

  //pref読み込み
  getPref: function (aPrefString, aPrefType, aDefault) {
    try {
      switch (aPrefType) {
        case "str":
          return this.prefs.getCharPref(aPrefString).toString(); break;
        case "int":
          return this.prefs.getIntPref(aPrefString); break;
        case "bool":
        default:
          return this.prefs.getBoolPref(aPrefString); break;
      }
    } catch (e) {
    }
    return aDefault;
  }

}

SidebarModoki.init();