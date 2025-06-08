# 🧮 SparxSolver - AI Math Problem Solver

A powerful Chrome extension that uses AI to solve Sparx Maths problems and store bookworks. This extension leverages Google's Gemini AI (Gemini) to provide detailed step-by-step solutions and explanations for mathematical problems.

## ✨ Features

- **🤖 AI-Powered Math Solving**: Uses Google's Gemini AI to analyze and solve complex math problems
- **📚 Saves Bookworks**: Save and organize solved problems for future reference
- **🔍 Step-by-Step Solutions**: Get detailed explanations with mathematical reasoning
- **⚡ Blazing Fast**: Faster than Gauth, utilising Gemini 2.5 Flash to deliver fast and accurate responses.
- **🖼️ LaTeX Rendering**: Beautiful mathematical notation using KaTeX
- **📸 Screenshot Analysis**: Automatically captures screenshots of math problems from Sparx Learning, even if the question is obscured (no need to zoom out!)

![SparxSolver solving a maths question](<sparxsolverdemo.png>)

## 🛠️ Installation & Setup

1. **Download the Extension**:
   - Click on [Releases](https://github.com/musairul/SparxSolver/releases) and download the Source code zip
   - Unzip the folder (right click and extract all)
   - You can now delete the folder ending with .zip

2. **Load the Extension**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `SparxSolver` folder
   - The extension should now appear in your extensions list
      - If you get an error saying `Manifest not found` (or something similar), you have selected the wrong folder. Try selecting the folder inside the folder.

4. **Pin the Extension**:
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "SparxSolver" for easy access

5. **Get Your Free Google AI API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
      - You must be over 18 and in supported countries to visit this link (so if it doesnt work, try using a google account that is)
   - Click "Create API Key"
   - Copy the generated API key (keep it secure!)

6. **Paste API key into the extension**: 
   - Go to maths.sparx-learning.com (the extension only opens on this link!)
   - Click on the extension
   - Enter your Google AI API key

## 🐛 Troubleshooting

- **Extension not appearing after "Load unpacked"**:
    - Ensure you have selected the correct `SparxSolver` folder. If you see a `manifest.json` file directly inside the folder you selected, that's the correct one.
    - Double-check that "Developer mode" is enabled on the `chrome://extensions/` page.
    - Try restarting Chrome.
- **"Manifest not found" error**:
    - You have likely selected the wrong folder. When you unzip the downloaded file, it might create a folder like `SparxSolver-main` and inside that, another `SparxSolver` folder. Make sure you select the inner `SparxSolver` folder that directly contains the `manifest.json` file.
- **API Key not working**:
    - Ensure you have copied the API key correctly from Google AI Studio.
    - Verify that the API key is enabled and has the necessary permissions in your Google Cloud project (if applicable, though for basic MakerSuite keys this is usually handled automatically).
    - Check if there are any restrictions on the API key (e.g., website restrictions) that might prevent it from working on `maths.sparx-learning.com`.
- **Extension popup doesn't open**:
    - Make sure you are on the `maths.sparx-learning.com` website, as the extension is designed to activate only on this domain.
    - Refresh the page and click on the extension again

## ⚠️ Disclaimer

**Educational Use Only**: This extension is designed to help students understand mathematical concepts and problem-solving approaches. Please use responsibly and in accordance with your institution's academic integrity policies.

**Privacy**: Your API key and bookwork are stored locally in your browser. No data is sent to external servers except for AI processing through Google's Generative AI service.

## 📞 Support, Bugs, Features

- **Issues**: Report bugs on [GitHub Issues](https://github.com/yourusername/sparxsolver/issues)
- **Questions**: Start a [Discussion](https://github.com/yourusername/sparxsolver/discussions)
- **Updates**: Watch the repository for new releases

## 🙏 Acknowledgments

- **Google AI**: For providing the Generative AI API
- **KaTeX**: For beautiful mathematical rendering
- **html2canvas**: For screenshot functionality
---

**Made with ❤️ for students learning mathematics**