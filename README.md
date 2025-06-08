# 🧮 SparxSolver - AI Math Problem Solver

A powerful Chrome extension that uses AI to solve math problems from Sparx Learning platform screenshots. This extension leverages Google's Generative AI (Gemini) to provide detailed step-by-step solutions and explanations for mathematical problems.

## ✨ Features

- **🤖 AI-Powered Math Solving**: Uses Google's Gemini AI to analyze and solve complex math problems
- **📸 Screenshot Analysis**: Automatically captures screenshots of math problems from Sparx Learning
- **📚 Bookwork Gallery**: Save and organize solved problems for future reference
- **🔍 Step-by-Step Solutions**: Get detailed explanations with mathematical reasoning
- **🎯 Sparx Learning Integration**: Seamlessly works within the Sparx Learning platform
- **💾 Local Storage**: Saves your API key and bookwork collection locally
- **🖼️ LaTeX Rendering**: Beautiful mathematical notation using KaTeX

## 🚀 What SparxSolver Does

SparxSolver is designed specifically for students using the Sparx Learning platform. It:

1. **Captures Math Problems**: Takes screenshots of math questions displayed on Sparx Learning
2. **AI Analysis**: Sends the captured image to Google's Gemini AI for analysis
3. **Provides Solutions**: Returns detailed step-by-step solutions with explanations
4. **Saves Progress**: Automatically saves completed bookwork with screenshots for review
5. **Educational Support**: Helps students understand problem-solving approaches

## 📋 Prerequisites

Before installing SparxSolver, you'll need:

- **Google Chrome Browser** (or any Chromium-based browser)
- **Google AI Studio API Key** (free from [Google AI Studio](https://makersuite.google.com/app/apikey))
- **Sparx Learning Account** (to access the platform where the extension works)

## 🛠️ Installation

### Option 1: Load as Unpacked Extension (Recommended for Development)

1. **Download the Extension**:
   ```bash
   git clone https://github.com/yourusername/sparxsolver.git
   cd sparxsolver
   ```

2. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `sparxsolver` folder
   - The extension should now appear in your extensions list

4. **Pin the Extension**:
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "SparxSolver" for easy access

### Option 2: Install from Chrome Web Store
*Coming soon - extension pending review*

## ⚙️ Setup & Configuration

### 1. Get Your Google AI API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key (keep it secure!)

### 2. Configure the Extension

1. **Navigate to Sparx Learning**: Go to any Sparx Learning page
2. **Open the Extension**: Click the SparxSolver icon in your browser toolbar
3. **Enter API Key**: 
   - The extension will prompt for your API key on first use
   - Paste your Google AI API key
   - Click "Save API Key"

### 3. Grant Permissions

The extension requires these permissions:
- **Active Tab**: To capture screenshots of math problems
- **Storage**: To save your API key and bookwork
- **Host Permissions**: To work specifically on Sparx Learning domains

## 📖 How to Use

### Solving Math Problems

1. **Navigate to a Sparx Problem**: Open any math problem on Sparx Learning
2. **Open SparxSolver**: Click the extension icon or use the floating interface
3. **Capture & Solve**:
   - Click "Solve Math Problem"
   - The extension will automatically capture the problem area
   - Wait for AI analysis (usually 5-10 seconds)
4. **Review Solution**: 
   - View the step-by-step solution
   - Read the detailed explanation
   - Mathematical expressions are rendered with LaTeX

### Managing Bookwork

1. **Auto-Save Feature**: Completed problems are automatically saved to your bookwork gallery
2. **View Saved Work**: 
   - Switch to the "Bookworks" tab
   - Browse your collection of solved problems
   - Click any image to view full-size
3. **Organize Collection**:
   - Problems are saved with timestamps
   - Use the "Clear" button to reset your collection

### Interface Navigation

- **Solve Tab**: Main problem-solving interface
- **Bookworks Tab**: Gallery of saved solutions
- **Settings**: Change API key anytime
- **Close Button**: Hide the extension interface

## 🏗️ Technical Architecture

### Core Components

- **`manifest.json`**: Extension configuration and permissions
- **`background.js`**: Service worker handling AI API calls
- **`content.js`**: Page interaction and UI injection
- **`popup.html/js/css`**: Main user interface
- **`bookwork.js`**: Bookwork detection and saving

### Dependencies

- **html2canvas**: Screenshot capture functionality
- **KaTeX**: Mathematical notation rendering
- **Google Generative AI**: Problem-solving backend

### File Structure

```
sparxsolver/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js            # Content script
├── popup.html            # Main UI
├── popup.js              # UI logic
├── popup.css             # Styling
├── bookwork.js           # Bookwork management
├── icon.png              # Extension icon
└── libs/                 # Third-party libraries
    ├── html2canvas.min.js
    ├── katex.min.js
    ├── katex.min.css
    ├── auto-render.min.js
    └── mhchem.min.js
```

## 🔧 Development

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/sparxsolver.git
   cd sparxsolver
   ```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the project folder

3. **Make changes and reload**:
   - Edit source files
   - Click the reload button on the extension card
   - Test on Sparx Learning pages

### Building for Production

The extension is ready to use as-is. For distribution:

1. **Create a ZIP package**:
   ```bash
   zip -r sparxsolver.zip . -x "*.git*" "README.md" "*.DS_Store*"
   ```

2. **Submit to Chrome Web Store** (requires developer account)

## 🐛 Troubleshooting

### Common Issues

**Extension not working on Sparx Learning**:
- Ensure you're on a `*.sparx-learning.com` domain
- Check that the extension is enabled
- Refresh the page and try again

**API Key errors**:
- Verify your Google AI Studio API key is correct
- Check that the API key has proper permissions
- Ensure you haven't exceeded rate limits

**Screenshot capture fails**:
- Check browser permissions
- Ensure the math problem is visible on screen
- Try refreshing the page

**Solutions not appearing**:
- Check your internet connection
- Verify the problem image is clear and readable
- Try a different problem to test functionality

### Debug Mode

Enable console logging by:
1. Opening Developer Tools (`F12`)
2. Checking the Console tab for `[SparxSolver]` messages
3. Report any errors in the project issues

## 🤝 Contributing

We welcome contributions! Here's how to help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Contribution Guidelines

- Follow existing code style
- Test all changes on Sparx Learning
- Update documentation for new features
- Ensure browser compatibility

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## ⚠️ Disclaimer

**Educational Use Only**: This extension is designed to help students understand mathematical concepts and problem-solving approaches. Please use responsibly and in accordance with your institution's academic integrity policies.

**Privacy**: Your API key and bookwork are stored locally in your browser. No data is sent to external servers except for AI processing through Google's Generative AI service.

## 📞 Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/yourusername/sparxsolver/issues)
- **Questions**: Start a [Discussion](https://github.com/yourusername/sparxsolver/discussions)
- **Updates**: Watch the repository for new releases

## 🙏 Acknowledgments

- **Google AI**: For providing the Generative AI API
- **KaTeX**: For beautiful mathematical rendering
- **html2canvas**: For screenshot functionality
- **Sparx Learning**: For creating an engaging math learning platform

---

**Made with ❤️ for students learning mathematics**