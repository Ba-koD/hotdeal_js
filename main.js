const { Client, IntentsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.DirectMessages] });

const dbPath = path.join(__dirname, 'data', 'keywords.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to database');
        db.run(`CREATE TABLE IF NOT EXISTS keywords (
            userId TEXT,
            keyword TEXT
        )`);
    }
});

const tokenPath = path.join(__dirname, 'data', '.token');
const channelsPath = path.join(__dirname, 'data', 'channels.json');
const urlsPath = path.join(__dirname, 'data', 'urls.json');
const lastPostsPath = path.join(__dirname, 'data', 'last_posts.json');

const token = fs.readFileSync(tokenPath, 'utf-8').trim();
const channels = loadChannels();
const urls = loadUrls();

function loadUrls() {
    const data = fs.readFileSync(urlsPath, 'utf-8');
    return JSON.parse(data);
}

function loadChannels() {
    if (fs.existsSync(channelsPath)) {
        const data = fs.readFileSync(channelsPath, 'utf-8');
        return JSON.parse(data);
    }
    return {};
}

function saveChannels(channels) {
    fs.writeFileSync(channelsPath, JSON.stringify(channels, null, 2));
}

function loadLastPostUrls() {
    try {
        const data = fs.readFileSync(lastPostsPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function saveLastPostUrls(lastPostUrls) {
    fs.writeFileSync(lastPostsPath, JSON.stringify(lastPostUrls, null, 2));
}

function loadKeywords(callback) {
    db.all("SELECT userId, keyword FROM keywords", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            callback({});
        } else {
            const keywordData = {};
            rows.forEach(row => {
                if (!keywordData[row.userId]) {
                    keywordData[row.userId] = [];
                }
                keywordData[row.userId].push(row.keyword);
            });
            callback(keywordData);
        }
    });
}

function addKeyword(userId, keyword, callback) {
    const normalizedKeyword = keyword.toLowerCase().replace(/\s/g, '');
    db.get(`SELECT keyword FROM keywords WHERE userId = ? AND REPLACE(LOWER(keyword), ' ', '') = ?`, [userId, normalizedKeyword], (err, row) => {
        if (err) {
            console.error(err.message);
            callback('error');
        } else if (row) {
            callback('duplicate');
        } else {
            db.run(`INSERT INTO keywords (userId, keyword) VALUES (?, ?)`, [userId, keyword], function (err) {
                if (err) {
                    console.error(err.message);
                    callback('error');
                } else {
                    callback('success');
                }
            });
        }
    });
}

function removeKeyword(userId, keyword, callback) {
    db.run(`DELETE FROM keywords WHERE userId = ? AND keyword = ?`, [userId, keyword], function (err) {
        if (err) {
            console.error(err.message);
            callback(false);
        } else {
            callback(true);
        }
    });
}

async function getLatestPost(urls) {
    const lastPostUrls = loadLastPostUrls();

    for (const [category, urlList] of Object.entries(urls)) {
        if (!channels[category]) {
            console.log(`Category '${category}' has no channel ID set. Skipping...`);
            continue;
        }

        for (const url of urlList) {
            try {
                const response = await axios.get(url);
                const $ = cheerio.load(response.data);
                let title, link;

                if (url.includes('quasarzone.com')) {
                    const firstTr = $('tbody tr').first();
                    title = firstTr.find('span.ellipsis-with-reply-cnt').text().trim();
                    link = 'https://quasarzone.com' + firstTr.find('a').attr('href');
                } else if (url.includes('arca.live')) {
                    const firstDiv = $('div.vrow.hybrid').first();
                    const linkTag = firstDiv.find('a.title.hybrid-title');
                    link = 'https://arca.live' + linkTag.attr('href');
                    const spanText = linkTag.find('span').text().trim();
                    title = linkTag.text().replace(spanText, '').trim();
                }

                if (lastPostUrls[url] !== link) {
                    lastPostUrls[url] = link;
                    const channelId = channels[category];
                    
                    // 채널 ID가 유효한 확인
                    if (!/^\d+$/.test(channelId)) {
                        console.error(`Invalid channel ID for category '${category}': ${channelId}`);
                        delete channels[category]; // channels.json에서 해당 채널 제거
                        saveChannels(channels); // 변경사항 저장
                        continue;
                    }

                    try {
                        const channel = await client.channels.fetch(channelId);
                        loadKeywords((keywordData) => {
                            const mentionUsers = [];

                            for (const [userId, keywords] of Object.entries(keywordData)) {
                                const normalizedTitle = title.toLowerCase().replace(/\s/g, '');
                                const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase().replace(/\s/g, ''));
                                if (normalizedKeywords.some(keyword => normalizedTitle.includes(keyword))) {
                                    mentionUsers.push(`<@${userId}>`);
                                }
                            }

                            const mentions = mentionUsers.join(' ');
                            const message = `새로운 게시글이 올라왔습니다!\n제목: ${title}\n링크: ${link}\n키워드 알림: ${mentions}`;
                            channel.send(message);
                            saveLastPostUrls(lastPostUrls);
                        });
                    } catch (err) {
                        if (err.code === 10003) { // Unknown Channel
                            console.error(`Unknown channel detected: ${channelId} for category '${category}'. Removing from channels.json.`);
                            delete channels[category];
                            saveChannels(channels);
                        } else {
                            console.error(`Error fetching channel ${channelId}: ${err}`);
                        }
                    }
                }
            } catch (err) {
                console.error(`Error processing ${url}: ${err}`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1100)); // 1초 대기
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('퀘이사존, 아카라이브 특가', { type: 'WATCHING' });

    // 슬래시 커맨드 등록
    const commands = [
        new SlashCommandBuilder()
            .setName('채널지정')
            .setDescription('특정 카테고리에 대한 채널 ID를 설정합니다.(ID 미입력시 자동으로 채널이 생성됩니다)')
            .addStringOption(option =>
                option.setName('카테고리')
                    .setDescription('카테고리를 선택하세요.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'pc-하드웨어', value: 'pc-하드웨어' },
                        { name: '상품권-쿠폰', value: '상품권-쿠폰' },
                        { name: '게임-sw', value: '게임-sw' },
                        { name: '노트북-모바일', value: '노트북-모바일' },
                        { name: '가전-tv', value: '가전-tv' },
                        { name: '전자제품', value: '전자제품' },
                        { name: '생활-식품', value: '생활-식품' },
                        { name: '패션-의류', value: '패션-의류' },
                        { name: '화장품', value: '화장품' },
                        { name: '기타', value: '기타' },
                        { name: '타세요', value: '타세요' }
                    ))
            .addStringOption(option =>
                option.setName('채널아이디')
                    .setDescription('채널 ID를 입력하세요.(#으로 가능)')
                    .setRequired(false)),
        new SlashCommandBuilder()
            .setName('키알등록')
            .setDescription('키워드를 등록합니다.')
            .addStringOption(option =>
                option.setName('키워드1')
                    .setDescription('등록할 첫 번째 키워드를 입력하세요.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('키워드2')
                    .setDescription('등록할 두 번째 키워드를 입력하세요.')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('키워드3')
                    .setDescription('등록할 세 번째 키워드를 입력하세요.')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('키워드4')
                    .setDescription('등록할 네 번째 키워드를 입력하세요.')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('키워드5')
                    .setDescription('등록할 다섯 번째 키워드를 입력하세요.')
                    .setRequired(false)),
        new SlashCommandBuilder()
            .setName('키알리스트')
            .setDescription('등록된 키워드 리스트를 확인하고 제거합니다.')
    ];

    await client.application.commands.set(commands);
    console.log('Slash commands registered.');

    async function crawlCategories() {
        if (Object.keys(channels).length === 0) {
            console.log('No channels set. Please use /채널지정 to set channels.');
        } else {
            await getLatestPost(urls);
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // 모든 카테고리 크롤링 후 1초 대기
        crawlCategories(); // 모든 카테고리 크롤링 후 다시 시작
    }

    crawlCategories();
});

const activeKeywordLists = new Set();

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === '채널지정') {
        const category = options.getString('카테고리');
        let channelId = options.getString('채널아이디');

        if (channels[category]&&!channelId) {
            await interaction.reply({ content: `카테고리 '${category}'에 대한 알림채널이 이미 지정되어 있습니다.`, ephemeral: true });
            return;
        }

        if (!channelId) {
            // 채널 ID가 비어있으면 새로운 채널 생성
            try {
                const guild = interaction.guild;
                const newChannel = await guild.channels.create({
                    name: category,
                    type: ChannelType.GuildText // ChannelType 사용
                });
                channelId = newChannel.id;
            } catch (error) {
                console.error('Error creating channel:', error);
                await interaction.reply({ content: '채널 생성에 실패했습니다.', ephemeral: true });
                return;
            }
        } else {
            // 채널 ID에서 숫자만 추출
            const channelIdMatch = channelId.match(/\d+/);
            if (channelIdMatch) {
                channelId = channelIdMatch[0];
            } else {
                await interaction.reply({ content: '유효한 채널 ID를 입력하세요.', ephemeral: true });
                return;
            }
        }

        channels[category] = channelId;
        saveChannels(channels);
        await interaction.reply({ content: `카테고리 '${category}'에 대한 알림채널이 '<#${channelId}>'로 설정되었습니다.`, ephemeral: true });
    } else if (commandName === '키알등록') {
        if (interaction.inGuild()) {
            await interaction.reply('이 명령어는 DM에서만 사용할 수 있습니다.', { ephemeral: true });
            return;
        }

        const userId = interaction.user.id;
        const keywords = [
            options.getString('키워드1'),
            options.getString('키워드2'),
            options.getString('키워드3'),
            options.getString('키워드4'),
            options.getString('키워드5')
        ].filter(Boolean);

        let results = {
            success: [],
            duplicate: [],
            error: []
        };

        keywords.forEach(keyword => {
            addKeyword(userId, keyword, (result) => {
                if (result === 'success') {
                    results.success.push(keyword);
                } else if (result === 'duplicate') {
                    results.duplicate.push(keyword);
                } else {
                    results.error.push(keyword);
                }

                if (results.success.length + results.duplicate.length + results.error.length === keywords.length) {
                    let replyMessage = '';
                    if (results.success.length > 0) {
                        replyMessage += `성공: ${results.success.join(', ')}\n`;
                    }
                    if (results.duplicate.length > 0) {
                        replyMessage += `중복: ${results.duplicate.join(', ')}\n`;
                    }
                    if (results.error.length > 0) {
                        replyMessage += `실패: ${results.error.join(', ')}\n`;
                    }
                    interaction.reply(replyMessage.trim());
                }
            });
        });
    } else if (commandName === '키알리스트') {
        const userId = interaction.user.id;

        if (interaction.inGuild()) {
            await interaction.reply('이 명령어는 DM에서만 사용할 수 있습니다.', { ephemeral: true });
            return;
        }

        if (activeKeywordLists.has(userId)) {
            await interaction.reply('이미 키워드 리스트가 열려 있습니다.', { ephemeral: true });
            return;
        }

        loadKeywords(async (keywordData) => {
            const userKeywords = keywordData[userId] || [];
            if (userKeywords.length === 0) {
                await interaction.reply('등록된 키워드가 없습니다.', { ephemeral: true });
                return;
            }

            activeKeywordLists.add(userId);

            const pageSize = 5;
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * pageSize;
                const end = start + pageSize;
                const keywordsPage = userKeywords.slice(start, end);
                const totalPages = Math.ceil(userKeywords.length / pageSize);
                const description = keywordsPage.length > 0 
                    ? keywordsPage.map((keyword, index) => `${start + index + 1}. ${keyword}`).join('\n')
                    : '등록된 키워드가 없습니다.';

                return new EmbedBuilder()
                    .setTitle(`등록된 키워드 리스트 (${page + 1}/${totalPages})`)
                    .setDescription(`${description}\n\n60초간 활동이 없으면 자동으로 리스트가 닫힙니다.`) // 추가된 부분
                    .setColor(0x0000FF); // BLUE를 16진수로 변경
            };

            const generateButtons = (page) => {
                const start = page * pageSize;
                const end = start + pageSize;
                const keywordsPage = userKeywords.slice(start, end);

                const keywordButtons = keywordsPage.length > 0 ? keywordsPage.map((keyword, index) => 
                    new ButtonBuilder()
                        .setCustomId(`remove_${start + index}`)
                        .setLabel(keyword)
                        .setStyle(ButtonStyle.Danger)
                ) : [];

                const navigationButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('이전')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('다음')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(end >= userKeywords.length),
                    new ButtonBuilder()
                        .setCustomId('close')
                        .setLabel('창닫기')
                        .setStyle(ButtonStyle.Danger)
                );

                return [new ActionRowBuilder().addComponents(keywordButtons), navigationButtons];
            };

            await interaction.reply({ embeds: [generateEmbed(currentPage)], components: generateButtons(currentPage) });

            const filter = i => i.user.id === userId;
            const dmChannel = await interaction.user.createDM();
            const collector = dmChannel.createMessageComponentCollector({ filter, time: 60000 });

            const resetCollectorTimer = () => {
                collector.resetTimer();
            };

            collector.on('collect', async i => {
                resetCollectorTimer(); // 타이머 재설정

                if (i.customId.startsWith('remove_')) {
                    const index = parseInt(i.customId.split('_')[1], 10);
                    const keywordToRemove = userKeywords[index];
                    removeKeyword(userId, keywordToRemove, async (success) => {
                        if (success) {
                            userKeywords.splice(index, 1); // 키워드 리스트에서 제거
                            if (userKeywords.length === 0) {
                                await i.update({ content: '등록된 키워드가 없습니다.', embeds: [], components: [] }, { ephemeral: true });
                                collector.stop('empty'); // 수동 종료
                            } else {
                                // 현재 페이지가 비어있으면 이전 페이지로 이동
                                if (currentPage * pageSize >= userKeywords.length && currentPage > 0) {
                                    currentPage--;
                                }
                                await i.update({ embeds: [generateEmbed(currentPage)], components: generateButtons(currentPage) });
                            }
                        } else {
                            await i.update({ content: `키워드 '${keywordToRemove}' 제거에 실패했습니다.`, embeds: [], components: [] }, { ephemeral: true });
                        }
                    });
                } else if (i.customId === 'previous') {
                    currentPage--;
                    await i.update({ embeds: [generateEmbed(currentPage)], components: generateButtons(currentPage) });
                } else if (i.customId === 'next') {
                    currentPage++;
                    await i.update({ embeds: [generateEmbed(currentPage)], components: generateButtons(currentPage) });
                } else if (i.customId === 'close') {
                    collector.stop('closed'); // 수동 종료
                }
            });

            collector.on('end', async (collected, reason) => {
                activeKeywordLists.delete(userId);
                if (reason === 'empty') {
                    await interaction.editReply({ content: '등록된 키워드가 없습니다.', embeds: [], components: [] });
                } else if (reason === 'closed') {
                    await interaction.editReply({ content: '창을 닫았습니다.', embeds: [], components: [] });
                } else {
                    await interaction.editReply({ content: '시간이 초과되었습니다.', embeds: [], components: [] });
                }
            });
        });
    }
});

const giverolePath = path.join(__dirname, 'giverole.js');
if (fs.existsSync(giverolePath)) {
    module.exports = client; // client 객체를 내보냅니다.
    const giverole = require(giverolePath);
}

client.login(token);