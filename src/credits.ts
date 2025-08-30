type Role = "Founder" | "Programmer" | "Designer" | "Artist" | "Musician" | "Sound Designer";

let message = "";

/* ---------- Utils ---------- */
const separator = () => { message += "\n\n\n\n"; };

const formatList = (items: string[]) => {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

/* ---------- Banner ---------- */
const banner = () => {
  message += (`                                                                      
      ▄▄▄▄                         ▄▄    ██                        
    ██▀▀▀▀█                        ██    ▀▀    ██               
   ██▀      ██▄████  ▄████▄   ▄███▄██  ████  ███████ ▄▄█████▄ 
   ██       ██▀     ██▄▄▄▄██ ██▀  ▀██    ██    ██    ██▄▄▄▄ ▀ 
   ██▄      ██      ██▀▀▀▀▀▀ ██    ██    ██    ██     ▀▀▀▀██▄ 
    ██▄▄▄▄█ ██      ▀██▄▄▄▄█ ▀██▄▄███  ▄▄██▄▄▄ ██▄▄▄ █▄▄▄▄▄██ 
      ▀▀▀▀  ▀▀        ▀▀▀▀▀    ▀▀▀ ▀▀ ▀▀▀▀▀▀▀▀  ▀▀▀▀  ▀▀▀▀▀▀  
                                                                        
         
                                                                              
                                                                        
    From the bottom of our hearts, thank you for playing.  
  This game was made with love, listening community needs,  
      and we’re so happy we got to share it with you.  
        Now, meet the people who made it all happen:
\n\n\n`
  );
};

/* ---------- Role messages (deterministic) ---------- */
const roleLines: Record<Role, { singular: string; plural: string }> = {
  Founder: {
    singular: "Yeah... I started this whole chaos. You're welcome.",
    plural:   "Yeah... we started this whole chaos. You're welcome."
  },
  Programmer: {
    singular: "I fought bugs so you could have this working. It was... painful.",
    plural:   "We fought bugs so you could have this working. It was... painful."
  },
  Designer: {
    singular: "I made it look pretty so you don’t rage-quit from ugly menus.",
    plural:   "We made it look pretty so you don’t rage-quit from ugly menus."
  },
  Artist: {
    singular: "Every pixel you see? That was me. Even the cursed ones.",
    plural:   "Every pixel you see? That was us. Even the cursed ones."
  },
  Musician: {
    singular: "I made the soundtrack so your journey never feels lonely.",
    plural:   "We made the soundtrack so your journey never feels lonely."
  },
  "Sound Designer": {
    singular: "I shaped the clicks, whooshes, and hits you can feel.",
    plural:   "We shaped the clicks, whooshes, and hits you can feel."
  }
};

const roleMessage = (role: Role, we = false) =>
  we ? roleLines[role].plural : roleLines[role].singular;

/* ---------- Credits blocks ---------- */
const iAm = (name: string, role: Role, link: string) => {
  message += `  Hello there, I'm ${name}.\n${roleMessage(role)}\n\nMore info at: ${link}`;
  separator();
};

const weAre = (names: string[], roles: Role[], links: string[]) => {
  // Basic validation to avoid mismatched arrays
  if (names.length !== roles.length || names.length !== links.length) {
    message += "  (credits data mismatch: names/roles/links must have same length)\n";
    separator();
    return;
  }

  message += `  Hello there, we are ${formatList(names)}.\n`;

  // One line per member for clarity
  for (let i = 0; i < names.length; i++) {
    message += `  • ${names[i]} — ${roleMessage(roles[i], true)}\n`;
  }

  message += `\nMore info at: ${links.join(", ")}\n`;
  separator();
};

/* ---------- Finish ---------- */
const finish = () => {
  message += "Thanks for playing!\n\n";
  console.log(message);
};

/* ---------- Public API ---------- */
export default function logCredits() {
  banner();
  iAm("Freddy", "Founder", "https://github.com/freddysae0");
  iAm("René", "Programmer", "https://github.com/reneespinosa");
  // weAre(["Pepe", "Juan", "Alfonso"], ["Artist", "Programmer", "Designer"], ["https://github.com/pepe", "https://github.com/juan", "https://github.com/alfonso"]);
  finish();
}
