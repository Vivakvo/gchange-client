/******
* !! WARNING: This is a generated file !!
*
* PLEASE DO NOT MODIFY DIRECTLY
*
* => Changes should be done on file 'app/config.json'.
******/

angular.module("cesium.config", [])

.constant("csConfig", {
	"fallbackLanguage": "fr-FR",
	"defaultLanguage": "fr-FR",
	"timeout": 300000,
	"cacheTimeMs": 300000,
	"useLocalStorage": true,
	"rememberMe": true,
	"useRelative": false,
	"decimalCount": 2,
	"helptip": {
		"enable": false
	},
	"node": {
		"host": "g1.duniter.fr",
		"port": "443"
	},
	"plugins": {
		"es": {
			"enable": true,
			"host": "data.gchange.fr",
			"port": "443"
		},
		"market": {
			"enable": true
		}
	},
	"version": "0.5.1",
	"build": "2017-08-03T19:47:34.207Z",
	"newIssueUrl": "https://github.com/duniter-gchange/gchange-client/issues/new?labels=bug"
})

;