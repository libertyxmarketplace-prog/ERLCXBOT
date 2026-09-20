/**
 * ============================================================================
 *                    ORLANDO SUPPORT - CONFIGURATION SETTINGS
 * ============================================================================
 */

export const CONFIG = {
  // Command Prefix for quick management commands (-close, -open)
  PREFIX: "-",

  // Top Banner Image (large header at top of panel & in tickets)
  TOP_BANNER_URL: "https://media.discordapp.net/attachments/1528834540599251100/1548863472329166908/orl.png?ex=6aad3844&is=6aabe6c4&hm=d75dbb4596a45253ae15ba8c40d564015ce09c33ac536694ea6093aaf9ec7e7d&=&format=webp&quality=lossless",

  // Bottom Banner Image (thin blue accent strip below buttons)
  BOTTOM_BANNER_URL: "https://media.discordapp.net/attachments/1528834540599251100/1548863471956005004/New_Project_-_2026-09-13T211015.958.png?ex=6aad3844&is=6aabe6c4&hm=2ba54eef28ee39f1b13e9fa0fee9dc4115ef281d2e8b0cb0a795256129658c52&=&format=webp&quality=lossless",

  // Channel ID where closed ticket logs and transcripts are sent
  TRANSCRIPTS_CHANNEL_ID: "1548876816171798678",

  // Array of Role IDs permitted to view, claim, and manage tickets
  STAFF_ROLE_IDS: [],

  // Panel text content matching exact reference screenshot (no bullet dot)
  PANEL_TITLE: "Orlando Support",
  PANEL_DESCRIPTION:
    "> If you require support, we ask you to **open a ticket and our team will be ready to help**. Choose the category that matches your issue below and a private channel will be opened for you. Any trolling or rule violations will result in instant moderation towards your account.",

  // Support categories (General and Management)
  CATEGORIES: [
    {
      id: "general",
      label: "General",
      fullName: "General Support",
      categoryId: "1548331057911173140",
      categoryIds: ["1548331057911173140", "1548641572013215874"]
    },
    {
      id: "management",
      label: "Management",
      fullName: "Management Support",
      categoryId: "1548330987128229989",
      categoryIds: ["1548330987128229989", "1548641524722573352"]
    }
  ],

  // Rules text redesigned with blockquotes and clean headers
  RULES_CONTENT: {
    title: "ORLANDO ROLEPLAY | TICKET CENTER",
    description: 
      "> Need help, want to report an issue, or have a question for our team? Select the ticket option that best matches your situation.\n" +
      "> Before opening a ticket, please read the information below carefully.\n\n" +
      "### TICKET GUIDELINES\n" +
      "> • Only open a ticket when you have a legitimate reason for doing so.\n" +
      "> • Please do not spam, troll, or intentionally misuse the ticket system.\n" +
      "> • Be respectful when speaking with our staff team. Disrespect, arguing, or unnecessary behavior may result in moderation action.\n\n" +
      "### RESPONSE REQUIREMENTS\n" +
      "> • Please respond to your ticket within 24 hours. Tickets with no response may be closed.\n" +
      "> • If your ticket requires a specific format, make sure to complete it after opening your ticket.\n" +
      "> • Provide clear and accurate information so our team can assist you properly.\n\n" +
      "### STAFF REPORTS\n" +
      "> • Staff reports should include valid evidence whenever possible.\n" +
      "> • Screenshots, recordings, logs, or reliable witnesses may be used as supporting evidence.\n" +
      "> • Reports without enough information may be closed by Internal Affairs or Management.\n\n" +
      "### IMPORTANT\n" +
      "> • Staff may take action depending on the circumstances of each situation.\n" +
      "> • Ticket decisions and punishments may vary based on the severity of the situation.\n" +
      "> • Please do not open multiple tickets for the same issue unless instructed by staff.\n" +
      "> • Ticket transcripts may be archived through our ticket system.\n\n" +
      "### ORLANDO ROLEPLAY\n" +
      "> Ensure your ticket has a valid reason and provide all necessary details. Rule violations lead to moderation."
  },

  // ER:LC Live Session Information Settings
  SESSION: {
    API_KEY: "hRuRFYohGUkyRiRfUiXP-iAJxPmVLVGGcCVnXBkXHcXMOKTxACCtjqkjTgVub",
    API_BASE: "https://api.erlc.gg/v1",
    TOP_BANNER_URL: "https://media.discordapp.net/attachments/1549619044443881562/1550251964934266980/700C2C5F-87DF-4040-9B5D-199F13E4FFFB.png?ex=6aada826&is=6aac56a6&hm=8106843f406d2c1b4b0956a60fcbf65d93b336981d1867ffcccdf60456fdf908&=&format=webp&quality=lossless&width=2048&height=684",
    BOTTOM_BANNER_URL: "https://media.discordapp.net/attachments/1550286332918501436/1550287860970684556/New_Project_-_2026-09-13T211015.958.png?ex=6aadc995&is=6aac7815&hm=a3a555030d639e62bfdcd1dafd55c6583dc5bd06d4295f0185ee739bf5d761d4&=&format=webp&quality=lossless",
    NOTIFICATION_ROLE_ID: "1548112626389618718",
    DEFAULT_JOIN_CODE: "olrpp",
    DESCRIPTION:
      "> Orlando Roleplay runs live, staff-supervised operations. Hop into the private server for structured patrols, realistic calls, and a respectful community atmosphere.",
    CHANNEL_ID: "1548147260297322496",
    INGAME_VC_ID: "1550318371340550254",
    QUEUE_VC_ID: "1550318480136470638",
    VOTE_TOP_BANNER_URL: "https://cdn.discordapp.com/attachments/1548876816171798678/1550301406764990494/orlando_session_vote.png?ex=6aadd632&is=6aac84b2&hm=e1a6ed0bdc0c1d8095d39fda70caaaa8fca3349f0a32c6c4d16208e93f79e41b&",
    VOTE_BOTTOM_BANNER_URL: "https://media.discordapp.net/attachments/1528834540599251100/1548863471956005004/New_Project_-_2026-09-13T211015.958.png?ex=6aad3844&is=6aabe6c4&hm=2ba54eef28ee39f1b13e9fa0fee9dc4115ef281d2e8b0cb0a795256129658c52&=&format=webp&quality=lossless"
  },

  // Staff Applications System Configuration
  APPLICATIONS: {
    TOP_BANNER_PATH: "./assets/applications_banner.png",
    REVIEW_CHANNEL_ID: "1550446015859925012",
    RESULTS_CHANNEL_ID: "1550413729013829725",
    TRAINING_CHANNEL_ID: "1548146597743960146",
    ARROW_LEFT_EMOJI_ID: "1550446757396348958",
    ARROW_RIGHT_EMOJI_ID: "1550446417376448593",
    COLOR: "#0a84fd"
  },

  // Welcome System Configuration
  WELCOME: {
    ENABLED: false, // Set to true (or use -welcome on) to re-enable
    CHANNEL_ID: "1548147497854181397",
    NAVIGATE_CHANNEL_ID: "1544355964348801178",
    WELCOME_EMOJI: "<:welcome:1548529700731752478>",
    PEOPLE_EMOJI_ID: "1547025501703372820",
    PEOPLE_EMOJI_NAME: "People",
    SERVER_NAME: "Orlando Roleplay"
  },

  // Departments System Configuration
  DEPARTMENTS: {
    ARROW_EMOJI: "<:Right_arrow:1550446417376448593>",
    TOP_BANNER_PATH: "./assets/department_banner.png",
    SERVER_NAME: "Orlando Roleplay"
  }
};
