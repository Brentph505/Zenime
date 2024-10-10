<h1 align="center">
    Zenime
  </h1>
  
  <p align="center">
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-%23007acc.svg?style=for-the-badge&logo=typescript&logoColor=%23ffffff"/></a>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB"/></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/vite-%239269fe.svg?style=for-the-badge&logo=vite&logoColor=yellow&border"/></a>
  </p>
  
  <p align="center">
    <a href="https://styled-components.com/"><img src="https://img.shields.io/badge/styled--components-742b66.svg?style=for-the-badge&logo=styled-components&logoColor=#e682d5"/></a>
  </p>
  
  <p align="center">
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-339933.svg?style=for-the-badge&logo=node.js&logoColor=white"/></a>
    <a href="https://bunjs.dev/"><img src="https://img.shields.io/badge/Bun.js-febbd0.svg?style=for-the-badge&logo=bun&logoColor=f9f1e1"/></a>
    <a href="https://vercel.com/"><img src="https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white"/></a>
    <a href="https://www.cloudflare.com/"><img src="https://img.shields.io/badge/cloudflare-white.svg?style=for-the-badge&logo=cloudflare&logoColor=orange"/></a>
  </p>
  
  <p align="center">
    <a href="https://www.miruro.com" target="_blank">
      <img src="https://raw.githubusercontent.com/Brentph505/Zenime/main/src/assets/zenime-transparent-white.png" alt="Logo" width="200"/>
    </a>
  </p>
  
  <p align="center">
    <a href="https://github.com/Miruro-no-Kuon/Miruro/fork">
      <img src="https://img.shields.io/github/forks/Miruro-no-Kuon/Miruro?style=social" alt="fork"/>
    </a>
    <a href="https://discordapp.com/invite/pjsdJp96mY">
      <img src="https://discordapp.com/api/guilds/1199699127190167643/widget.png?style=shield" alt="Discord Shield"/>
    </a>
    <a href="https://github.com/Miruro-no-Kuon/Miruro/stargazers">
      <img src="https://img.shields.io/github/stars/Miruro-no-Kuon/Miruro?style=social" alt="stars"/>
    </a>
  </p>
  
  <div align="center">
  
  | Official Domains | Links                                      |
  | ---------------- | ------------------------------------------ |
  | Hub              | [miruro.com](https://www.miruro.com)       |
  | TV               | [miruro.tv](https://www.miruro.tv)         |
  | Online           | [miruro.online](https://www.miruro.online) |
  
  </div>
  
  ## What is Zenime?
  
  **Zenime** is a fork of the original **[Miruro](https://www.miruro.com)** repository, which serves as a comprehensive anime streaming platform. Zenime builds upon the foundation laid by Miruro, offering a similar user-friendly interface and seamless anime-watching experience with added enhancements and new features. 
  
  Explore anime with fast loading, minimalistic design, and options for both subtitles and dubs. You can also download episodes without creating an account.
  
  <details>
  <summary>Features [View More]</summary>
  
  ### General
  
  - Dub Anime support
  - User-friendly interface
  - Mobile responsive
  - Anilist login integration
  - Fast page load
  - Light/Dark theme
  - Continue watching section
  
  ### Watch Page
  
  - **Player**
    - Autoplay next episode
    - Skip op/ed button
    - Theater mode
  
  ### Coming Soon
  
  - Comment section
  - Join the Discord to see the full Roadmap!
  
  </details>
  
  ## Images
  
  <div style="text-align: left;">
    <img src="https://raw.githubusercontent.com/Miruro-no-kuon/.github/main/profile/home-page.webp" alt="Home Page" style="max-width: 70%;" >
    <details>
    <summary>Screenshots [View More]</summary>
    <br>
    <img src="https://raw.githubusercontent.com/Miruro-no-kuon/.github/main/profile/watch-page.webp" alt="Watch Page" style="max-width: 70%;">
    </details>
  </div>
  
  ## Installation and Local Development
  
  ### 1. Clone this repository using
  
## Installation and Local Development

### 1. Clone this repository using

```bash
git clone https://github.com/Brentph505/Zenime.git
```

```bash
cd Zenime
```

### 2. Installation

### Basic Pre-Requisites

> [!TIP]
> This platform is built on [Node.js](https://nodejs.org/) and utilizes [Bun](https://bun.sh/) to ensure the quickest response times achievable. While `npm` can also be used, the commands for npm would mirror those of Bun, simply substituting the specific commands accordingly.

> Bun is now available on **Windows**, **Linux**, and **macOS**. Below are the installation commands for each operating system.

### Install Bun

- Linux & macOS

```bash
curl -fsSL https://bun.sh/install | bash
```

- Windows

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Verify installations

- Check that both Node.js and Bun are correctly installed by running.

```bash
node -v
bun -v
```

### Install Dependencies

- You can use Bun to install dependencies quickly. If you prefer, `npm` can also be used with equivalent commands.

```bash
bun install
```

### Copy `.env.example` into `.env.local` in the root folder

- `.env.local` & `.env` are both viable options, you can also set
  `.env.test.local`,
  `.env.development.local` or
  `.env.production.local`

```bash
cp .env.example .env.local
```

### 3. Run on development &/or production (npm also works)

- Run on development mode

```bash
bun run dev
```

- Run on production mode

```bash
bun start
```
## Self-Hosting Notice

> [!CAUTION]
> Self-hosting this application is **strictly limited to personal use only**. Commercial utilization is **prohibited**, and the inclusion of advertisements on your self-hosted website may lead to serious consequences, including **potential site takedown measures**. Ensure compliance to avoid any legal or operational issues.

## License

This project is governed by a Custom BY-NC License. What does this entail? Simply put, you are permitted to utilize, distribute, and modify the code for non-commercial purposes. However, it is imperative that due credit is accorded to our platform, [miruro.com](https://www.miruro.com). Any commercial utilization of this code is strictly prohibited. For comprehensive details, please refer to the [LICENSE](LICENSE) file. Should you have inquiries or require special permissions, do not hesitate to contact us.

## Found a Bug?

Uh-oh, looks like you stumbled upon a bug? No worries, we're here to squash it! Just head over to our [**issues**](https://github.com/Miruro-no-kuon/Miruro-no-Kuon/issues) section on GitHub and let us know what's up.

## Get in Touch!

Got questions, suggestions, or just wanna say hi? Drop us a line at <miruro@proton.me>. You can also hang out with us on Discord.

- Visit our website at **[miruro.com](https://www.miruro.com)**

- Follow us on **[Twitter](https://x.com/miruro_official)**

- Join our **[Subreddit](https://www.reddit.com/r/miruro)**

- Join our **[Discord](https://discord.gg/pjsdJp96mY)**

[![Join our Discord server!](https://invidget.switchblade.xyz/pjsdJp96mY)](http://discord.gg/pjsdJp96mY)

<!-- [![Miruro Discord Sever](https://invidget.switchblade.xyz/pjsdJp96mY)](https://discord.gg/pjsdJp96mY) -->

<!-- [![Discord Banner 2](https://discordapp.com/api/guilds/1199699127190167643/widget.png?style=banner2)](https://discord.com/invite/pjsdJp96mY) -->

## Support & Contributions
