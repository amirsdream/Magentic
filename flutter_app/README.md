# Magentic Flutter App

A responsive Flutter frontend for the Magentic AI orchestration system.

## Features

- 🎨 **Responsive Design** - Works on mobile, tablet, and desktop
- 🌓 **Dark/Light Theme** - System-aware with manual toggle
- 💬 **Real-time Chat** - WebSocket-based streaming responses
- 📊 **DAG Visualization** - Interactive workflow display
- 🔐 **Authentication** - Login/Register/Guest modes
- 📱 **Adaptive UI** - Sidebar drawer on mobile, side panel on desktop

## Architecture

```
lib/
├── config/           # Theme and constants
├── models/           # Data models (User, Message, Execution)
├── providers/        # Riverpod state management
├── screens/          # Full-screen views
├── services/         # API and WebSocket services
└── widgets/          # Reusable UI components
```

## State Management

Uses **Riverpod** for:
- `authProvider` - Authentication state
- `chatProvider` - Messages, executions, conversations
- `themeModeProvider` - Light/dark theme

## Getting Started

### Prerequisites

- Flutter SDK 3.2+
- Dart SDK 3.2+
- Running Magentic backend at `localhost:8000`

### Installation

```bash
# Navigate to flutter app
cd flutter_app

# Get dependencies
flutter pub get

# Run on device/emulator
flutter run
```

### Configuration

Edit `lib/config/constants.dart` to change API endpoints:

```dart
class AppConfig {
  static const String baseUrl = 'http://localhost:8000';
  static const String wsUrl = 'ws://localhost:8000/ws';
}
```

For production builds, use environment variables:

```bash
flutter run --dart-define=API_URL=https://api.example.com
```

## Building

### Android

```bash
flutter build apk --release
# or for App Bundle
flutter build appbundle --release
```

### iOS

```bash
flutter build ios --release
```

### Web

```bash
flutter build web --release
```

### Desktop

```bash
# macOS
flutter build macos --release

# Windows
flutter build windows --release

# Linux
flutter build linux --release
```

## Project Structure

### Models

- `User` - User profile data
- `ChatMessage` - Individual messages
- `ExecutionData` - Execution state with agents
- `AgentData` - Individual agent info
- `Conversation` - Chat session

### Widgets

- `AppSidebar` - Conversation list with grouping
- `AppHeader` - Top bar with user/connection status
- `ChatArea` - Message display area
- `ChatInput` - Text input with send/stop
- `ExecutionView` - Execution progress and output
- `FlowPanel` - DAG visualization panel

### Providers

- `authProvider` - Login/logout/guest
- `chatProvider` - Messages and WebSocket handling
- `themeModeProvider` - Theme persistence

## WebSocket Messages

The app handles these WebSocket message types:

| Type | Description |
|------|-------------|
| `status` | Execution stage updates |
| `plan` | Agent plan with DAG structure |
| `agent_start` | Agent begins execution |
| `agent_complete` | Agent finished |
| `agent_log` | Agent log messages |
| `stream_start` | Token streaming begins |
| `stream_token` | Individual token |
| `stream_end` | Streaming complete |
| `complete` | Full execution complete |
| `stopped` | User cancelled |
| `error` | Error occurred |

## Responsive Breakpoints

| Width | Layout |
|-------|--------|
| < 768px | Mobile - drawer sidebar, FAB for flow |
| 768-1200px | Tablet - visible sidebar, no flow panel |
| >= 1200px | Desktop - sidebar + flow panel |

## Screenshots

(Add screenshots here)

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run `flutter analyze` and `flutter test`
5. Submit PR

## License

MIT License - see LICENSE file
