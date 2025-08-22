// discord/bot.ts
import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import dotenv from "dotenv";
import { db, admin } from "./firebase";

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
});

const setupCmd = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Setup a gated role (Admin only).")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addRoleOption(o => o.setName("role").setDescription("Discord Role").setRequired(true))
  .addStringOption(o =>
    o.setName("type").setDescription("Role Type").setRequired(true).addChoices(
      { name: "NFT gated (ERC721/1155 balanceOf)", value: "nft_gated" },
      { name: "Token gated (ERC20 balance)", value: "token_gated" },
      { name: "Free (no requirement)", value: "free" },
    )
  )
  .addStringOption(o => o.setName("contract_address").setDescription("Contract (if gated)").setRequired(false))
  .addIntegerOption(o => o.setName("quantity").setDescription("Required amount (>=1)").setMinValue(1).setRequired(false))
  .addIntegerOption(o => o.setName("chain_id").setDescription("Chain ID (default server chain)").setRequired(false))
  .addStringOption(o => o.setName("notes").setDescription("Optional notes").setRequired(false));

const verifyCmd = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Get verification link to claim roles.");

const listCmd = new SlashCommandBuilder()
  .setName("roles")
  .setDescription("List server role gates (Admin only).")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

const commands = [setupCmd, verifyCmd, listCmd].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
    console.log("✅ Commands registered globally.");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  if (interaction.commandName === "setup") {
    await interaction.deferReply({ ephemeral: true });
    const role = interaction.options.getRole("role", true);
    const linkType = interaction.options.getString("type", true) as "nft_gated" | "token_gated" | "free";
    const contractAddress = interaction.options.getString("contract_address") ?? "";
    const requiredCount = interaction.options.getInteger("quantity") ?? 0;
    const chainId = interaction.options.getInteger("chain_id") ?? null;
    const notes = interaction.options.getString("notes") ?? "";

    if (linkType !== "free") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        await interaction.editReply("❌ Invalid contract address.");
        return;
      }
      if (!requiredCount || requiredCount < 1) {
        await interaction.editReply("❌ Required quantity must be >= 1 for gated roles.");
        return;
      }
    }

    try {
      await db.collection("serverSettings").doc(interaction.guild.id)
        .collection("roles")
        .doc(role.id)
        .set({
          guildId: interaction.guild.id,
          roleId: role.id,
          roleName: role.name,
          linkType,
          contractAddress: linkType === "free" ? null : contractAddress.toLowerCase(),
          requiredCount: linkType === "free" ? 0 : requiredCount,
          chainId: chainId ?? null,
          notes: notes || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

      await interaction.editReply(`✅ Setup saved for <@&${role.id}> (${linkType}${contractAddress ? ` • ${contractAddress}` : ""}${requiredCount ? ` • ≥${requiredCount}` : ""}).`);
    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Failed saving configuration.");
    }
    return;
  }

  if (interaction.commandName === "roles") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const snap = await db.collection("serverSettings").doc(interaction.guild.id).collection("roles").get();
      if (snap.empty) {
        await interaction.editReply("No gated roles configured.");
        return;
      }
      const lines = snap.docs.map(d => {
        const r = d.data();
        const base = `• <@&${r.roleId}> — ${r.linkType}`;
        if (r.linkType === "free") return base;
        return `${base} — ${r.contractAddress} — ≥${r.requiredCount}${r.chainId ? ` — chain ${r.chainId}` : ""}`;
      });
      await interaction.editReply(lines.join("\n"));
    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Failed to load roles.");
    }
    return;
  }

  if (interaction.commandName === "verify") {
    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/?guildId=${interaction.guild.id}&userId=${interaction.user.id}`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("Verify & Claim Roles").setURL(verificationUrl).setStyle(ButtonStyle.Link)
    );
    await interaction.reply({ content: "Click below to start.", components: [row], ephemeral: true });
    return;
  }
});

registerCommands();
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Failed to login:", err);
});