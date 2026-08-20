{
  "models": {
    "providers": {
      "inference": {
        "baseUrl": "https://inference.local/v1",
        "apiKey": "unused",
        "api": "openai-completions",
        "models": [
          {
            "id": "router",
            "name": "Router",
            "reasoning": true,
            "input": ["text", "image"],
            "contextWindow": 200000,
            "maxTokens": 64000,
            "compat": { "supportsStore": false }
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "inference/router",
        "fallbacks": []
      },
      "models": {
        "inference/router": { "alias": "Router" }
      },
      "workspace": "/sandbox/workspace"
    }
  },
  "tools": {
    "deny": ["gateway", "cron", "openclaw", "browser", "nodes"],
    "fs": { "workspaceOnly": true }
  },
  "plugins": {
    "deny": ["workboard", "admin-http-rpc"],
    "allow": ["mlflow-openclaw", "memory-core"],
    "entries": {
      "diagnostics-otel": {
        "enabled": false
      },
      "mlflow-openclaw": {
        "enabled": true,
        "config": {
          "trackingUri": "https://mlflow.redhat-ods-applications.svc:8443",
          "experimentId": "__MLFLOW_EXPERIMENT_ID__"
        },
        "hooks": {
          "allowConversationAccess": true
        }
      }
    }
  },
  "diagnostics": {
    "enabled": false
  },
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "mode": "password",
      "password": "__OPENCLAW_GATEWAY_PASSWORD__"
    },
    "controlUi": {
      "allowedOrigins": [
        "https://__UI_HOST__"
      ],
      "dangerouslyDisableDeviceAuth": true
    },
    "reload": {
      "mode": "off"
    },
    "nodes": {
      "denyCommands": ["system.run", "canvas.navigate"]
    },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  }
}
