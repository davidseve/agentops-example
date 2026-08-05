{
  "models": {
    "providers": {
      "maas": {
        "baseUrl": "https://maas-rhdp.apps.maas.redhatworkshops.io/v1",
        "apiKey": "__MAAS_API_KEY__",
        "api": "openai-completions",
        "models": [
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
      "model": { "primary": "maas/claude-sonnet-4-6" },
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
    "enabled": true,
    "otel": {
      "enabled": true,
      "traces": false,
      "metrics": true,
      "logs": false,
      "endpoint": "http://otel-collector.observability.svc:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-agent",
      "sampleRate": 1.0,
      "captureContent": true
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "mode": "trusted-proxy",
      "trustedProxy": {
        "userHeader": "x-forwarded-email",
        "requiredHeaders": ["x-forwarded-proto", "x-forwarded-host"],
        "allowLoopback": true
      }
    },
    "trustedProxies": ["127.0.0.1", "::1", "__POD_NETWORK_CIDR__", "__SERVICE_NETWORK_CIDR__"],
    "controlUi": {
      "allowedOrigins": [
        "https://openclaw-gw--openclaw-ui.__APPS_DOMAIN__"
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
