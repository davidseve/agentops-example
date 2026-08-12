{
  "models": {
    "providers": {
      "maas": {
        "baseUrl": "https://maas-rhdp.apps.maas.redhatworkshops.io/v1",
        "apiKey": "__MAAS_API_KEY__",
        "api": "openai-completions",
        "models": [
          {
            "id": "gpt-oss-120b",
            "name": "GPT-OSS 120B",
            "reasoning": true,
            "input": ["text"],
            "contextWindow": 32768,
            "maxTokens": 8192,
            "compat": { "supportsStore": false }
          },
          {
            "id": "llama-scout-17b",
            "name": "Llama Scout 17B",
            "reasoning": false,
            "input": ["text"],
            "contextWindow": 400000,
            "maxTokens": 8192,
            "compat": { "supportsStore": false }
          },
          {
            "id": "claude-sonnet-4-6",
            "name": "Claude Sonnet 4.6",
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
        "primary": "maas/claude-sonnet-4-6",
        "fallbacks": ["maas/gpt-oss-120b", "maas/llama-scout-17b"]
      },
      "models": {
        "maas/gpt-oss-120b": { "alias": "GPT-OSS-fallback" },
        "maas/llama-scout-17b": { "alias": "Scout-fallback" },
        "maas/claude-sonnet-4-6": { "alias": "Sonnet" }
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
        "chatCompletions": { "enabled": false }
      }
    }
  }
}
