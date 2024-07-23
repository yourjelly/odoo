{
    "name": "Websocket Log",
    "version": "1.0",
    "category": "Hidden",
    "description": "Keep track of user presence via websocket connections",
    "depends": ["mail"],
    "data": [
        "security/ir.model.access.csv",
    ],
    "assets": {
        "web.assets_backend": [
            "websocket_log/static/src/services/**/*.js",
        ],
        "web.assets_frontend": [
            "websocket_log/static/src/services/**/*.js",
        ],
    },
    "installable": True,
    "auto_install": True,
    "license": "LGPL-3",
}
