  function setStatus(msg,loading=false){document.getElementById("status").innerHTML=loading?`<span class="spinner"></span>${msg}`:msg;}
  function formatDate(ts){if(!ts)return"";return new Date(ts).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  function extractYouTubeId(input){
    input=input.trim();
    if(/^[a-zA-Z0-9_-]{11}$/.test(input))return input;
    const s=input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);if(s)return s[1];
    const l=input.match(/(?:v=|\/shorts\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);if(l)return l[1];
    return null;
  }
  function slugify(str){return str.replace(/[^a-z0-9]/gi,"_").slice(0,40);}

  function saveJSON(payload,filename){
    lastSavedJSON=payload;lastFileName=filename;
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=filename;a.click();
    URL.revokeObjectURL(url);
    showSaveBanner(filename,payload);
  }
  function reDownload(){
    if(!lastSavedJSON)return;
    const blob=new Blob([JSON.stringify(lastSavedJSON,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=lastFileName;a.click();
    URL.revokeObjectURL(url);
  }
  function showSaveBanner(filename,payload){
    const count=Array.isArray(payload.comments)?payload.comments.length:(payload.commentThreads?.length||0);
    const size=(JSON.stringify(payload).length/1024).toFixed(1);
    document.getElementById("saveBanner").style.display="block";
    document.getElementById("saveBanner").innerHTML=
      `<div class="save-banner"><div class="info"><strong>✅ Saved: ${filename}</strong><span>${count} comments • ${size} KB</span></div><button class="dl-btn" onclick="reDownload()\">⬇️ Again</button></div>`;
  }

  async function callAI(prompt, temp = 0.2) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTERKEY}`
    },
    body: JSON.stringify({
      model: 'openrouter/auto',          // Auto-routes to best model for large context
      messages: [{ role: 'user', content: prompt }],
      reasoning: { enabled: true },
      temperature: temp,
      max_tokens: 6000,                  // Enough for full JSON response
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data.choices?.[0]?.message?.content;
}


  function parseJSON(raw){
    raw=raw.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
    const m=raw.match(/\{[\s\S]*\}/);
    if(!m)throw new Error("No JSON found in AI response");
    return JSON.parse(m[0]);
  }

  // ══ 2. SENTIMENT ══
  async function runSentimentAnalysis(texts,total){
    document.getElementById("sentimentSection").style.display="block";
    document.getElementById("sentimentLoading").style.display="flex";
    document.getElementById("sentimentContent").style.display="none";
    try{
      const raw=await callAI(
        `Analyze these ${texts.length} social media comments. Classify each into: Happy, Love, Excited, Angry, Sad, Toxic, Neutral, Sarcasm.\n\nComments:\n${texts.slice(0,200).map((t,i)=>`${i+1}. ${t.slice(0,150)}`).join("\n")}\n\nRespond ONLY valid JSON:\n{"counts":{"Happy":0,"Love":0,"Excited":0,"Angry":0,"Sad":0,"Toxic":0,"Neutral":0,"Sarcasm":0},"overall_mood":"Positive|Negative|Mixed|Neutral","insight":"2-3 sentence summary"}`,
        0.1
      );
      renderSentimentChart(parseJSON(raw),total);
    }catch(err){
      document.getElementById("sentimentLoading").innerHTML=`<p style="color:#e63946;font-family:'Segoe UI',sans-serif">⚠️ ${err.message}</p>`;
    }
  }

  function renderSentimentChart(result,totalComments){
    const counts=result.counts;const maxVal=Math.max(...Object.values(counts),1);
    const bars=[
      {key:"Happy",emoji:"😄",cls:"pos",label:"Happy"},
      {key:"Love",emoji:"❤️",cls:"pos",label:"Love"},
      {key:"Excited",emoji:"🔥",cls:"pos",label:"Excited"},
      {key:"Angry",emoji:"😡",cls:"neg",label:"Angry",sep:true},
      {key:"Sad",emoji:"😢",cls:"neg",label:"Sad"},
      {key:"Toxic",emoji:"🤬",cls:"neg",label:"Toxic"},
      {key:"Neutral",emoji:"😐",cls:"neu",label:"Neutral",sep:true},
      {key:"Sarcasm",emoji:"😏",cls:"neu",label:"Sarcasm"}
    ];
    document.getElementById("graphWrapper").innerHTML=bars.map(b=>{
      const val=counts[b.key]||0;const pct=Math.round((val/maxVal)*100);
      return `<div class="bar-group${b.sep?" sep-left":""}">
        <span class="emoji">${b.emoji}</span>
        <div class="bar ${b.cls}" id="bar-${b.key}" style="height:0%" data-target="${pct}">
          <span class="count">${val}</span>
        </div>
        <span class="label">${b.label}</span>
      </div>`;
    }).join("");

    const posTotal=(counts.Happy||0)+(counts.Love||0)+(counts.Excited||0);
    const negTotal=(counts.Angry||0)+(counts.Sad||0)+(counts.Toxic||0);
    const neuTotal=(counts.Neutral||0)+(counts.Sarcasm||0);
    document.getElementById("sentimentSummary").innerHTML=
      `<div class="sentiment-pill pill-pos">😊 Positive: ${posTotal} (${Math.round(posTotal/totalComments*100)}%)</div>
       <div class="sentiment-pill pill-neg">😤 Negative: ${negTotal} (${Math.round(negTotal/totalComments*100)}%)</div>
       <div class="sentiment-pill pill-neu">😐 Other: ${neuTotal} (${Math.round(neuTotal/totalComments*100)}%)</div>`;

    const mood=result.overall_mood||"Neutral";
    const moodMap={
      Positive:{cls:"mood-pos",icon:"🌟",text:"Overall: Positive Audience"},
      Negative:{cls:"mood-neg",icon:"⚠️",text:"Overall: Negative Audience"},
      Mixed:{cls:"mood-mix",icon:"⚖️",text:"Overall: Mixed Reactions"},
      Neutral:{cls:"mood-neu",icon:"😐",text:"Overall: Neutral Audience"}
    };
    const m=moodMap[mood]||moodMap.Neutral;
    document.getElementById("moodBadge").className=`mood-badge ${m.cls}`;
    document.getElementById("moodBadge").textContent=`${m.icon} ${m.text}`;
    document.getElementById("aiInsightText").textContent=result.insight||"";
    document.getElementById("sentimentSubtitle").textContent=`${totalComments} comments analyzed`;
    document.getElementById("sentimentLoading").style.display="none";
    document.getElementById("sentimentContent").style.display="flex";

    requestAnimationFrame(()=>setTimeout(()=>{
      bars.forEach(b=>{
        const el=document.getElementById(`bar-${b.key}`);
        if(el){el.style.height=el.dataset.target+"%";el.classList.add("animated");}
      });
    },100));
  }

  // ══ 3. AUDIENCE SUMMARY ══
  async function runAudienceSummary(texts,total,platform){
    document.getElementById("audienceSummarySection").style.display="block";
    document.getElementById("audienceLoading").style.display="flex";
    document.getElementById("audienceContent").style.display="none";
    try{
      const raw=await callAI(
        `You are an expert social media analyst. Analyze these ${texts.length} ${platform==="yt"?"YouTube":"Instagram"} comments and generate exactly 10 key audience insights.\n\nFor each: short title (max 6 words), description (1-2 sentences), estimated comment count (out of ${total}), category (positive/negative/concern/suggestion/highlight/general), relevant emoji.\n\nComments:\n${texts.slice(0,200).map((t,i)=>`${i+1}. ${t.slice(0,150)}`).join("\n")}\n\nRespond ONLY valid JSON:\n{"items":[{"rank":1,"icon":"🌟","category":"positive","title":"Short title","description":"Description.","commentCount":42}],"totalAnalyzed":${total}}`,
        0.2
      );
      renderAudienceSummary(parseJSON(raw),total);
    }catch(err){
      document.getElementById("audienceLoading").innerHTML=`<p style="color:#f87171;font-family:'Segoe UI',sans-serif">⚠️ ${err.message}</p>`;
    }
  }

  function renderAudienceSummary(result,totalCount){
    const items=result.items||[];
    const catMap={
      positive:{cls:"cat-positive",iconCls:"icon-positive"},
      negative:{cls:"cat-negative",iconCls:"icon-negative"},
      concern:{cls:"cat-concern",iconCls:"icon-concern"},
      suggestion:{cls:"cat-suggestion",iconCls:"icon-suggestion"},
      highlight:{cls:"cat-highlight",iconCls:"icon-highlight"},
      general:{cls:"cat-general",iconCls:"icon-general"}
    };
    document.getElementById("summaryGrid").innerHTML=items.slice(0,10).map(item=>{
      const cat=catMap[item.category]||catMap.general;
      const pct=Math.round((item.commentCount/totalCount)*100);
      return `<div class="summary-item">
        <div class="summary-rank">${item.rank||"#"}</div>
        <div class="summary-icon ${cat.iconCls}">${item.icon||"💬"}</div>
        <div class="summary-body">
          <div class="summary-category ${cat.cls}">${item.category?.toUpperCase()}</div>
          <div class="summary-title">${item.title||""}</div>
          <div class="summary-desc">${item.description||""}</div>
          <div class="comment-count-pill">💬 ~${item.commentCount} comments<span style="color:#6b7280;font-weight:400"> • ${pct}%</span></div>
        </div>
      </div>`;
    }).join("");
    document.getElementById("audienceSubtitle").textContent=
      `Based on ${totalCount} comments • ${items.length} key insights extracted`;
    document.getElementById("audienceFooter").innerHTML=
      `Generated by <strong>OpenRouter hunter-alpha</strong> • ${new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}`;
    document.getElementById("audienceLoading").style.display="none";
    document.getElementById("audienceContent").style.display="flex";
  }

  // ══ 4. TOPIC IDENTIFICATION ══
  async function runTopicIdentification(texts,total){
    document.getElementById("topicSection").style.display="block";
    document.getElementById("topicLoading").style.display="flex";
    document.getElementById("topicContent").style.display="none";
    try{
      const raw=await callAI(
        `Analyze these ${texts.length} social media comments and identify the main topics being discussed.\n\nComments:\n${texts.slice(0,200).map((t,i)=>`${i+1}. ${t.slice(0,150)}`).join("\n")}\n\nRespond ONLY valid JSON:\n{"headline":"ONE punchy sentence under 30 words summarizing what viewers are talking about overall","description":"A 100-word paragraph describing the emotional expression, tone, and what drives the audience reaction in these comments","tags":[{"label":"topic name","count":42}]}\n\nProvide 6-8 tags with estimated comment counts.`,
        0.3
      );
      renderTopicSection(parseJSON(raw),total);
    }catch(err){
      document.getElementById("topicLoading").innerHTML=`<p style="color:#833ab4;font-family:'Segoe UI',sans-serif">⚠️ ${err.message}</p>`;
    }
  }

  function renderTopicSection(result,total){
    document.getElementById("topicCommentCount").textContent=total;
    document.getElementById("topicHeadline").innerHTML=result.headline||"";
    document.getElementById("topicDescription").textContent=result.description||"";
    const tagClasses=["tag-1","tag-2","tag-3","tag-4","tag-5","tag-6","tag-7","tag-8"];
    document.getElementById("topicTags").innerHTML=(result.tags||[]).map((t,i)=>
      `<span class="topic-tag ${tagClasses[i%8]}" style="animation-delay:${0.1+(i*0.06)}s">
        ${t.label} <strong>·</strong> ${t.count}
      </span>`
    ).join("");
    document.getElementById("topicLoading").style.display="none";
    document.getElementById("topicContent").style.display="flex";
  }

  // ══ 5. PROFILE INSIGHTS ══
  async function runProfileInsights(texts,total,platform){
    document.getElementById("profileSection").style.display="block";
    document.getElementById("profileLoading").style.display="flex";
    document.getElementById("profileContent").style.display="none";
    try{
      const raw=await callAI(
        `You are an expert audience analyst. Analyze these ${texts.length} ${platform==="yt"?"YouTube":"Instagram"} comments and identify 4-6 distinct viewer profiles/archetypes based on comment patterns.\n\nComments:\n${texts.slice(0,200).map((t,i)=>`${i+1}. ${t.slice(0,150)}`).join("\n")}\n\nFor each profile provide:\n- A catchy profile name\n- An emoji avatar\n- A 1-2 sentence description\n- 3-4 bullet points of their typical opinions\n- Estimated percentage share of comments (must total ~100%)\n- Estimated comment count\n\nRespond ONLY valid JSON:\n{"profiles":[{"name":"Profile Name","emoji":"🎯","description":"Who they are.","opinions":["Opinion 1","Opinion 2","Opinion 3"],"sharePercent":35,"commentCount":70}],"totalAnalyzed":${total}}`,
        0.3
      );
      renderProfileInsights(parseJSON(raw),total);
    }catch(err){
      document.getElementById("profileLoading").innerHTML=`<p style="color:#818cf8;font-family:'Segoe UI',sans-serif">⚠️ ${err.message}</p>`;
    }
  }

  function renderProfileInsights(result,total){
    const profiles=result.profiles||[];
    document.getElementById("profilesGrid").innerHTML=profiles.map(p=>`
      <div class="profile-card">
        <div class="profile-card-top">
          <div class="profile-avatar">${p.emoji||"👤"}</div>
          <div>
            <div class="profile-name">${p.name||"Viewer"}</div>
            <div class="profile-share">
              <span class="profile-share-bar" style="width:${Math.min(p.sharePercent||0,100)*0.6}px"></span>
              ${p.sharePercent||0}% of audience
            </div>
          </div>
        </div>
        <div class="profile-desc">${p.description||""}</div>
        <ul class="profile-opinions">${(p.opinions||[]).map(o=>`<li>${o}</li>`).join("")}</ul>
        <div class="profile-count-badge">💬 ~${p.commentCount||0} comments</div>
      </div>`
    ).join("");
    document.getElementById("profileSubtitle").textContent=
      `${profiles.length} viewer archetypes identified from ${total} comments`;
    document.getElementById("profileFooter").innerHTML=
      `Powered by <strong>OpenRouter hunter-alpha</strong> • ${new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}`;
    document.getElementById("profileLoading").style.display="none";
    document.getElementById("profileContent").style.display="flex";
  }

  // ══ CHAT ══
  function initChat(jsonPayload,platform){
    const stripped=JSON.parse(JSON.stringify(jsonPayload));
    if(stripped.comments)stripped.comments.forEach(c=>delete c._raw);
    if(stripped.commentThreads)stripped.commentThreads.forEach(t=>delete t._raw);
    const dataStr=JSON.stringify(stripped,null,1);
    systemPrompt=
      `You are an expert social media analyst. You have the COMPLETE comments data from a ${platform==="yt"?"YouTube video":"Instagram post"}.\nFull data:\n${dataStr}\nAnswer questions concisely, use bullet points.`;
    chatHistory=[];
    document.getElementById("chatPlaceholder").style.display="none";
    const ca=document.getElementById("chatArea");ca.style.display="flex";ca.style.flexDirection="column";
    document.getElementById("chatInput").disabled=false;
    document.getElementById("sendBtn").disabled=false;
    document.getElementById("chatMessages").innerHTML="";
    document.getElementById("statusDot").className="chat-status-dot ready";
    document.getElementById("statusText").textContent="Ready";
    document.getElementById("dataLoadedBadge").style.display="flex";
    const count=stripped.comments?.length||stripped.commentThreads?.length||0;
    document.getElementById("dataLoadedText").textContent=`${count} comments loaded`;
    const chips=platform==="yt"
      ?["Overall sentiment?","Top liked?","Trending topics?","Toxic comments?","Summarize","Most active user?"]
      :["Overall sentiment?","Most liked?","Any spam?","Trending topics?","Top commenters?","Summarize all"];
    const cls=platform==="yt"?"suggestion-chip yt-chip":"suggestion-chip";
    document.getElementById("suggestions").innerHTML=chips.map(c=>`<button class="${cls}" onclick="askSuggestion('${c}')">${c}</button>`).join("");
    document.getElementById("tokenInfo").innerHTML=
      `Context: ~<strong>${Math.round(dataStr.length/4).toLocaleString()}</strong> tokens`;
    appendMessage("ai",`👋 **${count} comments** loaded! Ask anything.`);
  }

  function askSuggestion(text){document.getElementById("chatInput").value=text;sendMessage();}
  function handleKey(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}
  function autoResize(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,100)+"px";}

  function markdownLite(text){
    return text
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,"<em>$1</em>")
      .replace(/`(.+?)`/g,"<code>$1</code>")
      .replace(/^[-•] (.+)$/gm,"<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s,"<ul>$1</ul>")
      .replace(/\n/g,"<br>");
  }

  function appendMessage(role,text){
    const msgs=document.getElementById("chatMessages");
    const time=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
    const div=document.createElement("div");div.className=`msg ${role}`;
    div.innerHTML=
      `<div class="msg-avatar">${role==="user"?"U":"AI"}</div>
       <div><div class="msg-bubble">${markdownLite(text)}</div><div class="msg-time">${time}</div></div>`;
    msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
  }
  function appendTyping(){
    const msgs=document.getElementById("chatMessages");
    const div=document.createElement("div");div.className="msg ai";div.id="typingIndicator";
    div.innerHTML=`<div class="msg-avatar">AI</div><div class="typing-bubble"><span></span><span></span><span></span></div>`;
    msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
  }
  function removeTyping(){const t=document.getElementById("typingIndicator");if(t)t.remove();}

  async function sendMessage(){
    const input=document.getElementById("chatInput");const text=input.value.trim();
    if(!text||!systemPrompt)return;
    input.value="";input.style.height="auto";
    document.getElementById("sendBtn").disabled=true;
    document.getElementById("statusDot").className="chat-status-dot thinking";
    document.getElementById("statusText").textContent="Thinking...";
    appendMessage("user",text);chatHistory.push({role:"user",content:text});appendTyping();
    try{
      const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENROUTER_KEY}`},
        body:JSON.stringify({
          model:"openrouter/hunter-alpha",
          messages:[{role:"system",content:systemPrompt},...chatHistory],
          reasoning:{enabled:true}
        })
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error?.message||`HTTP ${res.status}`);
      const choice=data.choices?.[0];
      const reply=choice?.message?.content||"No response.";
      const reasoning=choice?.message?.reasoning;
      chatHistory.push({role:"assistant",content:reply});
      removeTyping();
      if(reasoning){
        const msgs=document.getElementById("chatMessages");
        const time=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
        const div=document.createElement("div");div.className="msg ai";
        div.innerHTML=
          `<div class="msg-avatar">AI</div>
           <div>
             <div class="msg-bubble">
               <details style="margin-bottom:8px;font-size:0.78rem;color:#888;">
                 <summary style="cursor:pointer;font-weight:600;">🧠 View Reasoning</summary>
                 <pre style="white-space:pre-wrap;margin-top:6px;padding:8px;background:#f9f9f9;border-radius:8px;font-size:0.75rem;line-height:1.4;">${reasoning.replace(/</g,"&lt;")}</pre>
               </details>
               ${markdownLite(reply)}
             </div>
             <div class="msg-time">${time}</div>
           </div>`;
        msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
      }else{
        appendMessage("ai",reply);
      }
      if(data.usage){
        document.getElementById("tokenInfo").innerHTML=
          `Last: <strong>${data.usage.prompt_tokens}</strong>+<strong>${data.usage.completion_tokens}</strong>=<strong>${data.usage.total_tokens}</strong> tokens`;
      }
    }catch(err){
      removeTyping();
      appendMessage("ai",`⚠️ **Error:** ${err.message}`);
    }
    document.getElementById("sendBtn").disabled=false;
    document.getElementById("statusDot").className="chat-status-dot ready";
    document.getElementById("statusText").textContent="Ready";
  }

  // ══ MAIN ROUTER ══
  function fetchComments(){
    document.getElementById("results").innerHTML="";
    document.getElementById("saveBanner").style.display="none";
    ["sentimentSection","audienceSummarySection","topicSection","profileSection","countrySection","spamSection","summarySection","personaSection","predictionSection"]
  .forEach(id => document.getElementById(id).style.display = "none");

    if(!currentPlatform){
      detectPlatform();
      if(!currentPlatform)return setStatus("❌ Please paste a valid Instagram or YouTube URL.");
    }
    currentPlatform==="insta"?fetchInstagram():fetchYouTube();
  }

  function getCommentTexts(payload,platform){
    if(platform==="insta")return (payload.comments||[]).map(c=>c.text).filter(Boolean);
    return (payload.commentThreads||[]).map(t=>t.topLevelComment?.text||t.topLevelComment?.textDisplay||"").filter(Boolean);
  }

  // ══ TOP DISCUSSION COMPUTE ══
  function computeTopDiscussionThread(payload, platform) {
    let threads = [];

    if (platform === "insta") {
        document.getElementById("discussionSection").style.visibility = "hidden";
      threads = (payload.comments || [])
        .map(c => ({
          platform: "insta",
          id: c.id || "",
          author: c.ownerUsername || "User",
          avatar: c.ownerProfilePicUrl || "",
          text: c.text || "",
          timestamp: c.timestamp || null,
          likes: c.likesCount || 0,
          replyCount: c.repliesCount || (c.replies?.length || 0),
          replies: (c.replies || []).map(r => ({
            author: r.ownerUsername || "User",
            avatar: "",
            text: r.text || "",
            timestamp: r.timestamp || null,
            likes: r.likesCount || 0
          }))
        }))
        .filter(t => t.replies.length > 0);
    } else {
      threads = (payload.commentThreads || [])
        .map(t => {
          const top = t.topLevelComment || {};
          return {
            platform: "yt",
            id: t.threadId || t.id || "",
            author: top.authorDisplayName || "User",
            avatar: top.authorProfileImageUrl || "",
            text: top.textDisplay || top.textOriginal || "",
            timestamp: top.publishedAt || null,
            likes: top.likeCount || 0,
            replyCount: t.totalReplyCount || (t.replies?.length || 0),
            replies: (t.replies || []).map(r => ({
              author: r.authorDisplayName || "User",
              avatar: r.authorProfileImageUrl || "",
              text: r.text || r.textDisplay || "",
              timestamp: r.publishedAt || null,
              likes: r.likeCount || 0
            }))
          };
        })
        .filter(t => t.replies.length > 0);
    }

    if (!threads.length) {
      document.getElementById("discussionSection").style.display = "block";
      document.getElementById("discussionThread").style.display = "none";
      document.getElementById("discussionEmpty").style.display = "block";
      _topDiscussionSnapshot = null;
      return;
    }

    threads.sort((a,b)=>{
      if(b.replies.length!==a.replies.length)return b.replies.length-a.replies.length;
      return b.likes-a.likes;
    });
    const best = threads[0];

    _topDiscussionSnapshot = {
      platform: best.platform,
      id: best.id,
      author: best.author,
      text: best.text,
      timestamp: best.timestamp,
      likes: best.likes,
      replyCount: best.replies.length,
      replies: best.replies
    };

    renderDiscussionThread(best);
  }

  function renderDiscussionThread(thread) {
    document.getElementById("discussionSection").style.display = "block";
    document.getElementById("discussionEmpty").style.display = "none";
    document.getElementById("discussionThread").style.display = "block";

    const isInsta = thread.platform === "insta";

    document.getElementById("discussionMetaSmall").textContent =
      `${thread.replies.length} replies • ${formatDate(thread.timestamp) || "time unknown"}`;

    const platformPillClass = isInsta ? "platform-pill-insta" : "platform-pill-yt";
    const platformLabel = isInsta ? "Instagram" : "YouTube";

    const oldMeta=document.querySelector(".discussion-meta");
    if(oldMeta)oldMeta.remove();
    const meta=document.createElement("div");
    meta.className="discussion-meta";
    meta.innerHTML =
      `<div class="discussion-meta-left">
        <span class="platform-pill ${platformPillClass}">${platformLabel}</span>
        <span>${thread.replyCount} replies • Top discussion</span>
      </div>
      <div class="discussion-meta-right">
        <span>Top comment likes: <strong>${thread.likes}</strong></span>
      </div>`;
    const header=document.querySelector(".discussion-header");
    header.insertAdjacentElement("afterend",meta);

    const main=document.getElementById("discussionMain");
    const avatarHTML = thread.avatar
      ? `<div class="discussion-avatar"><img src="${thread.avatar}" alt=""></div>`
      : `<div class="discussion-avatar">${(thread.author || "U").slice(0,2).toUpperCase()}</div>`;

    main.innerHTML =
      `<div class="discussion-main-header">
        ${avatarHTML}
        <div>
          <div class="discussion-author">${thread.author}</div>
          <div class="discussion-meta-line">${formatDate(thread.timestamp) || ""}</div>
        </div>
      </div>
      <div class="discussion-text">${thread.text}</div>
      <div class="discussion-main-footer">
        <span>👍 ${thread.likes}</span>
        <span>💬 ${thread.replyCount} replies</span>
      </div>`;

    const repliesBox=document.getElementById("discussionReplies");
    document.getElementById("discussionReplyCount").textContent =
      `${thread.replyCount} repl${thread.replyCount === 1 ? "y" : "ies"}`;

    repliesBox.innerHTML = thread.replies.map(r=>{
      const av = r.avatar
        ? `<div class="discussion-reply-avatar"><img src="${r.avatar}" alt=""></div>`
        : `<div class="discussion-reply-avatar">${(r.author || "U").slice(0,2).toUpperCase()}</div>`;
      return `<div class="discussion-reply">
        ${av}
        <div class="discussion-reply-body">
          <div class="discussion-reply-top">
            <strong>${r.author}</strong>
            <span>${formatDate(r.timestamp) || ""}</span>
          </div>
          <div class="discussion-reply-text">${r.text}</div>
          <div class="discussion-reply-meta">👍 ${r.likes || 0}</div>
        </div>
      </div>`;
    }).join("");
  }

  // ══ COUNTRY FLAG MAP ══
  const FLAG_MAP={
    "india":"🇮🇳","united states":"🇺🇸","usa":"🇺🇸","uk":"🇬🇧","united kingdom":"🇬🇧","england":"🇬🇧",
    "canada":"🇨🇦","australia":"🇦🇺","germany":"🇩🇪","france":"🇫🇷","italy":"🇮🇹","spain":"🇪🇸",
    "pakistan":"🇵🇰","bangladesh":"🇧🇩","nepal":"🇳🇵","sri lanka":"🇱🇰","uae":"🇦🇪","dubai":"🇦🇪",
    "saudi arabia":"🇸🇦","qatar":"🇶🇦","oman":"🇴🇲","kuwait":"🇰🇼","bahrain":"🇧🇭","russia":"🇷🇺",
    "china":"🇨🇳","japan":"🇯🇵","south korea":"🇰🇷","brazil":"🇧🇷","mexico":"🇲🇽","indonesia":"🇮🇩",
    "philippines":"🇵🇭","turkey":"🇹🇷","nigeria":"🇳🇬","south africa":"🇿🇦","argentina":"🇦🇷"
  };
  function getFlag(country){
    if(!country)return"🌍";
    const key=country.toLowerCase().trim();
    return FLAG_MAP[key]||"🌍";
  }

  // ══ COUNTRY OPINION MAP (AI) ══
  async function runCountryOpinionMap(texts, dummy, total){
    document.getElementById("countrySection").style.display="block";
    document.getElementById("countryLoading").style.display="flex";
    document.getElementById("countryContent").style.display="none";

    const stepsBox=document.getElementById("countryLoadingSteps");
    const loadingSteps=[
      "Extracting country hints from usernames and text...",
      "Normalizing locations and grouping by country...",
      "Calculating positive vs negative share per country...",
      "Preparing stunning cards and stats..."
    ];
    let step=0;
    const timer=setInterval(()=>{
      if(step<loadingSteps.length){
        stepsBox.innerHTML=loadingSteps.slice(0,step+1).map(s=>"• "+s).join("<br>");
        step++;
      }else clearInterval(timer);
    },2200);

    const combined=texts.map((t,i)=>`[user:${_authorNames[i]||"unknown"}] ${t}`).slice(0,200);

    try{
      const raw=await callAI(
        `You are mapping where Instagram/YouTube commenters are from.\n\nYou get a list of comments with approximate usernames, many will be Indian.\nInfer each commenter's likely country using language, slang, references, and user hint.\n\nComments with hint:\n${combined.map((t,i)=>`${i+1}. ${t.slice(0,200)}`).join("\n")}\n\nReturn ONLY JSON:\n{\n  "countries": {\n    "India": {"pos": 0, "neg": 0, "neu": 0, "examples": ["short example 1"]},\n    "United States": {...}\n  },\n  "unknownCount": 0,\n  "notes": "1-2 sentence summary"\n}`,
        0.2
      );
      const result=parseJSON(raw);
      buildCountryMap(result, total);
    }catch(err){
      clearInterval(timer);
      document.getElementById("countryLoading").innerHTML=
        `<p style="color:#38bdf8;font-family:'Segoe UI',sans-serif">⚠️ Country map error: ${err.message}</p>`;
    }
  }

  function buildCountryMap(result,total){
    const countriesObj=result.countries||{};
    const unknownCount=result.unknownCount||0;
    const entries=Object.entries(countriesObj).map(([name,data])=>{
      const pos=data.pos||0,neg=data.neg||0,neu=data.neu||0;
      const tot=pos+neg+neu||1;
      return [name,{...data,pos,neg,neu,total:tot}];
    });
    const sorted=entries.sort((a,b)=>b[1].total-a[1].total);
    const countriesFound=sorted.length;
    const totalClassified=sorted.reduce((a,[,d])=>a+d.total,0);
    const totalComments=total||totalClassified+unknownCount;

    const topCountry=sorted[0]?.[0]||"Unknown";
    const posLeader=sorted.slice().sort((a,b)=>b[1].pos-a[1].pos)[0]||["Unknown",{pos:0,total:1}];

    document.getElementById("countryStatsRow").innerHTML =
      `<div class="country-stat-pill">
         <div class="stat-num">${totalComments}</div>
         <div class="stat-label">Total Comments</div>
       </div>
       <div class="country-stat-pill">
         <div class="stat-num">${countriesFound}</div>
         <div class="stat-label">Countries</div>
       </div>
       <div class="country-stat-pill">
         <div class="stat-num">${getFlag(topCountry)}</div>
         <div class="stat-label">Top: ${topCountry}</div>
       </div>
       <div class="country-stat-pill">
         <div class="stat-num">${getFlag(posLeader[0])}</div>
         <div class="stat-label">Most Positive: ${posLeader[0]}</div>
       </div>`;

    document.getElementById("countryGrid").innerHTML=sorted.map(([country,d],idx)=>{
      const flag=getFlag(country);
      const posP=Math.round(d.pos/d.total*100);
      const negP=Math.round(d.neg/d.total*100);
      const neuP=100-posP-negP;
      const share=Math.round(d.total/Math.max(totalClassified,1)*100);
      const dominant=d.pos>=d.neg&&d.pos>=d.neu
        ?{cls:"mood-dom-pos",label:"😊 Mostly Positive"}
        :d.neg>d.pos&&d.neg>=d.neu
          ?{cls:"mood-dom-neg",label:"😤 Mostly Negative"}
          :{cls:"mood-dom-neu",label:"😐 Mostly Neutral"};
      return `<div class="country-card">
        <div class="country-rank">#${idx+1} · ${share}%</div>
        <div class="country-card-top">
          <div class="country-flag">${flag}</div>
          <div class="country-name-block">
            <div class="country-name">${country}</div>
            <div class="country-comment-count">💬 ${d.total} comment${d.total>1?"s":""}</div>
          </div>
        </div>
        <div class="country-sentiment-bar">
          <div class="csb-pos" style="width:${posP}%"></div>
          <div class="csb-neg" style="width:${negP}%"></div>
          <div class="csb-neu" style="width:${neuP}%"></div>
        </div>
        <div class="country-sentiment-pills">
          <span class="cs-pill cs-pill-pos">😊 ${posP}% Positive</span>
          <span class="cs-pill cs-pill-neg">😤 ${negP}% Negative</span>
          <span class="cs-pill cs-pill-neu">😐 ${neuP}% Neutral</span>
        </div>
        <div class="country-mood ${dominant.cls}">${dominant.label}</div>
        ${d.examples?.length?`<div style="margin-top:10px;font-size:0.78rem;color:#94a3b8;">“${d.examples[0]}”</div>`:""}
      </div>`;
    }).join("");

    if(unknownCount>0){
      document.getElementById("unknownStrip").innerHTML=
        `<div class="unknown-strip">
          <span>🌐 <strong>${unknownCount}</strong> comments had unidentifiable origin (generic usernames, numbers, etc.)</span>
          <span style="font-size:0.72rem;color:#334155">${Math.round(unknownCount/Math.max(totalComments,1)*100)}% of total</span>
        </div>`;
    }else{
      document.getElementById("unknownStrip").innerHTML="";
    }

    document.getElementById("countrySubtitle").textContent=
      `${countriesFound} countries detected across ${totalClassified} comments`;
    document.getElementById("countryFooter").innerHTML=
      `<div class="cerebras-badge">Powered by Cerebras llama-3.3-70b · Ultra-fast inference</div>
       <span style="color:#1e293b">${new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span>`;

    document.getElementById("countryLoading").style.display="none";
    document.getElementById("countryContent").style.display="flex";

    // Snapshots for JSON saving
    _countryMapSnapshot = {
      generatedAt: new Date().toISOString(),
      totalComments,
      totalClassified,
      unknownCount,
      countries: sorted.map(([name,d])=>({
        country: name,
        pos: d.pos,
        neg: d.neg,
        neu: d.neu,
        total: d.total,
        examples: d.examples||[]
      }))
    };

    const hateCountries = sorted
      .filter(([,d])=>d.neg>0)
      .map(([country,d])=>({
        country,
        flag:getFlag(country),
        neg:d.neg,
        total:d.total
      }));
    const totalNegAll = hateCountries.reduce((a,c)=>a+c.neg,0)||1;
    hateCountries.forEach(c=>{c.shareOfGlobalNeg=+(c.neg/totalNegAll*100).toFixed(1);});
    _hateSourceSnapshot = {
      generatedAt:new Date().toISOString(),
      totalNegativeComments: totalNegAll,
      countries: hateCountries
    };

    renderHatePie(sorted);
    saveCountryAndHateJSON();
  }

  function renderHatePie(sorted){
    document.getElementById("hatePieSection").style.display="block";
    document.getElementById("hatePieLoading").style.display="flex";
    document.getElementById("hatePieContent").style.display="none";

    const hateData=sorted
      .filter(([,d])=>d.neg>0)
      .map(([country,d])=>({
        country,
        flag:getFlag(country),
        neg:d.neg,
        total:d.total,
        negPct:Math.round(d.neg/Math.max(d.total,1)*100)
      }))
      .sort((a,b)=>b.neg-a.neg)
      .slice(0,8);

    if(!hateData.length){
      document.getElementById("hatePieLoading").innerHTML=
        `<p style="color:#34d399;font-family:'Segoe UI',sans-serif;font-size:1.1rem;">🎉 No significant hate found!</p>`;
      return;
    }

    const totalHate=hateData.reduce((a,d)=>a+d.neg,0);
    const topHater=hateData[0];
    const COLORS=["#dc2626","#ef4444","#f87171","#b91c1c","#fb923c","#f97316","#fca5a5","#fbbf24"];

    document.getElementById("hateStatsRow").innerHTML=
      `<div class="hate-stat-pill">
         <div class="stat-num">${totalHate}</div>
         <div class="stat-label">Total Hate</div>
       </div>
       <div class="hate-stat-pill">
         <div class="stat-num">${hateData.length}</div>
         <div class="stat-label">Countries</div>
       </div>
       <div class="hate-stat-pill">
         <div class="stat-num">${topHater.flag}</div>
         <div class="stat-label">Top Source: ${topHater.country}</div>
       </div>
       <div class="hate-stat-pill">
         <div class="stat-num">${Math.round(topHater.neg/totalHate*100)}%</div>
         <div class="stat-label">Max Share</div>
       </div>`;

    document.getElementById("pieCenterBig").textContent=totalHate;

    const cx=160,cy=160,r=130,inner=68;
    let startAngle=-Math.PI/2;
    const svg=document.getElementById("hatePieSVG");
    svg.innerHTML="";

    hateData.forEach((d,i)=>{
      const sliceAngle=d.neg/totalHate*2*Math.PI;
      const endAngle=startAngle+sliceAngle;
      const midAngle=startAngle+sliceAngle/2;

      const x1=cx+r*Math.cos(startAngle);
      const y1=cy+r*Math.sin(startAngle);
      const x2=cx+r*Math.cos(endAngle);
      const y2=cy+r*Math.sin(endAngle);
      const ix1=cx+inner*Math.cos(startAngle);
      const iy1=cy+inner*Math.sin(startAngle);
      const ix2=cx+inner*Math.cos(endAngle);
      const iy2=cy+inner*Math.sin(endAngle);
      const largeArc=sliceAngle>Math.PI?1:0;

      const path=document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d",
        `M ${ix1} ${iy1} L ${x1} ${y1}
         A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}
         L ${ix2} ${iy2}
         A ${inner} ${inner} 0 ${largeArc} 0 ${ix1} ${iy1} Z`);
      path.setAttribute("fill",COLORS[i%COLORS.length]);
      path.setAttribute("stroke","#1a0000");
      path.setAttribute("stroke-width","2");
      path.setAttribute("class","pie-slice");

      const title=document.createElementNS("http://www.w3.org/2000/svg","title");
      title.textContent=`${d.flag} ${d.country}: ${d.neg} hate comments (${Math.round(d.neg/totalHate*100)}%)`;
      path.appendChild(title);

      path.addEventListener("mouseenter",()=>{
        document.querySelectorAll(".pie-legend-item").forEach((el,j)=>{
          el.style.opacity=j===i?"1":"0.4";
        });
      });
      path.addEventListener("mouseleave",()=>{
        document.querySelectorAll(".pie-legend-item").forEach(el=>{el.style.opacity="1";});
      });

      svg.appendChild(path);

      const pct=Math.round(d.neg/totalHate*100);
      if(pct>=6){
        const lx=cx+r*0.68*Math.cos(midAngle);
        const ly=cy+r*0.68*Math.sin(midAngle);
        const text=document.createElementNS("http://www.w3.org/2000/svg","text");
        text.setAttribute("x",lx);
        text.setAttribute("y",ly);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("dominant-baseline","middle");
        text.setAttribute("fill","#fff");
        text.setAttribute("font-size","11");
        text.setAttribute("font-weight","800");
        text.setAttribute("font-family","Segoe UI, sans-serif");
        text.textContent=`${pct}%`;
        svg.appendChild(text);
      }

      startAngle=endAngle;
    });

    document.getElementById("pieLegend").innerHTML=hateData.map((d,i)=>{
      const share=Math.round(d.neg/totalHate*100);
      return `<div class="pie-legend-item" onmouseenter="highlightSlice(${i})" onmouseleave="resetSlices()">
        <div class="pie-legend-dot" style="background:${COLORS[i%COLORS.length]}"></div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="pie-legend-flag">${d.flag}</span>
            <span class="pie-legend-name">${d.country}</span>
            <span class="pie-legend-pct">${share}%</span>
          </div>
          <div class="pie-legend-count">${d.neg} hate comment${d.neg>1?"s":""} · ${d.negPct}% of their total</div>
        </div>
      </div>`;
    }).join("");

    document.getElementById("hatePieSubtitle").textContent=
      `${totalHate} negative comments across ${hateData.length} countries`;
    document.getElementById("hatePieFooter").innerHTML=
      `<div class="cerebras-badge" style="background:rgba(248,113,113,0.08);border-color:rgba(248,113,113,0.2);color:#f87171;">
         📊 Data sourced from Country Opinion Map • Section 6
       </div>
       <span style="color:#3b0a0a">
         ${new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}
       </span>`;

    document.getElementById("hatePieLoading").style.display="none";
    document.getElementById("hatePieContent").style.display="flex";

    const allSlices=svg.querySelectorAll(".pie-slice");
    allSlices.forEach((s,i)=>{
      s.style.opacity="0";
      s.style.transform="scale(0.7)";
      setTimeout(()=>{
        s.style.transition=
          `opacity 0.4s ${i*0.08}s ease, transform 0.4s ${i*0.08}s cubic-bezier(0.34,1.56,0.64,1)`;
        s.style.opacity="1";
        s.style.transform="scale(1)";
      },50);
    });
  }
  function highlightSlice(idx){
    const slices=document.querySelectorAll(".pie-slice");
    slices.forEach((s,i)=>{s.style.opacity=i===idx?"1":"0.35";});
  }
  function resetSlices(){
    document.querySelectorAll(".pie-slice").forEach(s=>{s.style.opacity="1";});
  }

  function saveCountryAndHateJSON(){
    if(!_countryMapSnapshot || !_hateSourceSnapshot)return;
    const ts=new Date().toISOString().slice(0,19).replace(/:/g,"-");
    const combined={
      countryOpinionMap: _countryMapSnapshot,
      hateSourceByCountry: _hateSourceSnapshot,
      topDiscussionThread: _topDiscussionSnapshot || null
    };
    const filename=`country_hate_discussion_${ts}.json`;
    saveJSON(combined,filename);
  }
// ══ HELPER: format number (1.2M, 45K) ══
function fmtNum(n) {
  n = parseInt(n) || 0;
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}

// ══ HELPER: parse ISO 8601 duration (PT4M32S → 4:32) ══
function parseDuration(d) {
  if (!d) return '';
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1]||0), mi = parseInt(m[2]||0), s = parseInt(m[3]||0);
  if (h) return `${h}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${mi}:${String(s).padStart(2,'0')}`;
}

// ══ HELPER: wait for Apify run ══
async function waitApifyRun(runId) {
  for (let i = 0; i < 20; i++) {
    await sleep(5000);
    const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFYTOKEN}`)).json();
    const st = s.data.status;
    setStatus(`⏳ Apify: ${st} (${i+1}/20)...`, true);
    if (st === 'SUCCEEDED') return s.data.defaultDatasetId;
    if (['FAILED','ABORTED','TIMED-OUT'].includes(st)) throw new Error(`Apify run ended: ${st}`);
  }
  throw new Error('Apify timeout');
}

// ══ RENDER YOUTUBE HERO ══
function renderYTHero(meta, videoId) {
  const v = meta.videoInfo || {};
  const thumb =
    v.thumbnails?.maxres?.url ||
    v.thumbnails?.high?.url ||
    v.thumbnails?.medium?.url ||
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  document.getElementById('ytThumbImg').src = thumb;
  document.getElementById('ytThumbImg').onerror = function() {
    this.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  const dur = parseDuration(v.duration);
  if (dur) document.getElementById('ytDuration').textContent = dur;

  // Make play button open YouTube
  document.getElementById('ytPlayBtn').onclick = () =>
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');

  // Channel
  const ch = v.channelTitle || 'Unknown Channel';
  document.getElementById('ytChannelName').textContent = ch;
  document.getElementById('ytChannelAvatar').textContent = ch[0] || '▶';
  if (v.viewCount) {
    document.getElementById('ytChannelSub').textContent =
      `${fmtNum(v.viewCount)} views on this video`;
  }

  // Title
  document.getElementById('ytVideoTitle').textContent = v.title || 'YouTube Video';

  // Stats
  const stats = [
    { num: fmtNum(v.viewCount), label: 'Views', icon: '👁️' },
    { num: fmtNum(v.likeCount), label: 'Likes', icon: '👍' },
    { num: fmtNum(v.commentCount), label: 'Comments', icon: '💬' },
  ];
  document.getElementById('ytStatsRow').innerHTML = stats.map(s => `
    <div class="yt-stat">
      <div style="font-size:1.3rem;margin-bottom:4px;">${s.icon}</div>
      <div class="yt-stat-num">${s.num}</div>
      <div class="yt-stat-label">${s.label}</div>
    </div>
  `).join('');

  // Description
  const desc = v.description || 'No description available.';
  document.getElementById('ytDescBox').textContent =
    desc.length > 300 ? desc.slice(0,300)+'… (click to expand)' : desc;
  document.getElementById('ytDescBox').title = desc;
  document.getElementById('ytDescBox').onclick = function() {
    this.textContent = this.classList.contains('expanded')
      ? (desc.slice(0,300)+'… (click to expand)')
      : desc;
    this.classList.toggle('expanded');
  };

  // Tags
  const tags = (v.tags || []).slice(0,12);
  document.getElementById('ytTagsRow').innerHTML = tags.map(t =>
    `<span class="yt-tag">#${t}</span>`
  ).join('');

  // Published
  if (v.publishedAt) {
    document.getElementById('ytPublished').innerHTML =
      `📅 Published ${new Date(v.publishedAt).toLocaleDateString('en-IN',{dateStyle:'long'})}`;
  }

  document.getElementById('postHeroLoading').style.display = 'none';
  document.getElementById('ytHero').style.display = 'flex';

  // Smooth scroll hint
  setTimeout(() => {
    document.getElementById('ytHero').scrollIntoView({behavior:'smooth',block:'start'});
  }, 200);
}

// ══ RENDER INSTAGRAM HERO ══
function renderInstaHero(postData) {
  // postData can be from apify/instagram-scraper
  const p = postData || {};

  // Media — try multiple field names
  const imgUrl =
    p.displayUrl || p.displayImage || p.thumbnailUrl ||
    p.images?.[0] || p.mediaUrls?.[0] || '';

  const imgEl = document.getElementById('instaThumbImg');
  if (imgUrl) {
    imgEl.src = imgUrl;
    imgEl.onerror = () => {
      imgEl.parentElement.innerHTML =
        `<div style="width:100%;height:300px;background:linear-gradient(135deg,#833ab4,#fcb045);
         border-radius:20px;display:flex;align-items:center;justify-content:center;
         font-size:4rem;">📸</div>`;
    };
  } else {
    imgEl.parentElement.style.display = 'none';
  }

  // Media type badge
  const isVideo = p.type === 'Video' || p.isVideo || p.videoUrl;
  document.getElementById('instaMediaType').textContent =
    isVideo ? '🎬 VIDEO' : (p.type === 'Sidecar' ? '📎 CAROUSEL' : '📷 IMAGE');
  if (isVideo) document.getElementById('instaVideoPlay').style.display = 'flex';

  // Profile
  const username = p.ownerUsername || p.username || p.ownerId || 'unknown';
  const fullname = p.ownerFullName || p.fullName || '';
  const isVerified = p.ownerIsVerified || p.verified || false;
  const avatarUrl = p.ownerProfilePicUrl || p.profilePicUrl || '';

  document.getElementById('instaUsername').textContent = '@' + username;
  document.getElementById('instaFullname').textContent = fullname;

  if (isVerified) document.getElementById('instaVerified').style.display = 'inline';

  const avatarWrap = document.getElementById('instaAvatarWrap');
  if (avatarUrl) {
    avatarWrap.innerHTML = `<img src="${avatarUrl}" alt="avatar"
      onerror="this.parentElement.innerHTML='<div class=insta-profile-avatar-placeholder>${username[0]?.toUpperCase()||'U'}</div>'"
      style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    document.getElementById('instaAvatarPlaceholder').textContent =
      username[0]?.toUpperCase() || 'U';
  }

  // Caption
  const caption = p.caption || p.text || p.description || 'No caption.';
  const captEl = document.getElementById('instaCaption');
  captEl.textContent = caption.length > 250
    ? caption.slice(0,250) + '… (tap to expand)' : caption;
  captEl.onclick = function() {
    this.textContent = this.classList.contains('expanded')
      ? (caption.slice(0,250)+'… (tap to expand)') : caption;
    this.classList.toggle('expanded');
  };

  // Stats
  const likes = p.likesCount ?? p.likes ?? p.likeCount ?? 0;
  const comments = p.commentsCount ?? p.comments ?? p.commentCount ?? 0;
  const views = p.videoViewCount ?? p.viewCount ?? p.videoViews ?? 0;
  const stats = [
    { num: fmtNum(likes), label: 'Likes', icon: '❤️' },
    { num: fmtNum(comments), label: 'Comments', icon: '💬' },
    ...(views > 0 ? [{ num: fmtNum(views), label: 'Views', icon: '👁️' }] : []),
  ];
  document.getElementById('instaStatsRow').innerHTML = stats.map(s => `
    <div class="insta-stat">
      <div style="font-size:1.2rem;margin-bottom:4px;">${s.icon}</div>
      <div class="insta-stat-num">${s.num}</div>
      <div class="insta-stat-label">${s.label}</div>
    </div>
  `).join('');

  // Hashtags
  const tags = p.hashtags || caption.match(/#\w+/g) || [];
  document.getElementById('instaHashtags').innerHTML = tags.slice(0,15).map(t =>
    `<span class="insta-hashtag">${t.startsWith('#')?t:'#'+t}</span>`
  ).join('');

  // Meta
  const postUrl = p.url || p.shortCode ? `https://instagram.com/p/${p.shortCode}/` : '';
  const timestamp = p.timestamp || p.takenAt || p.taken_at_timestamp;
  document.getElementById('instaPostMeta').innerHTML = [
    timestamp ? `<span>📅 ${new Date(timestamp).toLocaleDateString('en-IN',{dateStyle:'long'})}</span>` : '',
    p.locationName ? `<span>📍 ${p.locationName}</span>` : '',
    postUrl ? `<span>🔗 <a href="${postUrl}" target="_blank" style="color:#a78bfa;text-decoration:none;">View on Instagram</a></span>` : '',
  ].filter(Boolean).join('');

  document.getElementById('postHeroLoading').style.display = 'none';
  document.getElementById('instaHero').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('instaHero').scrollIntoView({behavior:'smooth',block:'start'});
  }, 200);
}

// ══ FETCH INSTAGRAM (UPDATED) ══
async function fetchInstagram() {
  const postUrl = document.getElementById('urlInput').value.trim();
  const maxComments = parseInt(document.getElementById('maxComments').value) || 50;
  const inclReplies = document.getElementById('includeReplies').value === 'true';
  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;

  // Show hero loading first
  document.getElementById('postHeroSection').style.display = 'block';
  document.getElementById('postHeroLoading').style.display = 'flex';
  document.getElementById('postHeroLoading').classList.add('insta-loading');
  document.getElementById('postHeroLoadingText').textContent = '✨ Fetching Instagram post details...';
  document.getElementById('instaHero').style.display = 'none';
  document.getElementById('ytHero').style.display = 'none';

  try {
    // ── Step 1: Fetch post details via apify/instagram-scraper ──
    setStatus('🚀 Starting apify/instagram-scraper...', true);
    const postRunRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${APIFYTOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [postUrl],
          resultsType: 'posts',
          resultsLimit: 1,
          addParentData: false,
        })
      }
    );
    if (!postRunRes.ok) throw new Error(`Instagram scraper failed: ${postRunRes.status}`);
    const postRunData = await postRunRes.json();
    const postRunId = postRunData.data.id;

    // Poll for post details
    const postDsId = await waitApifyRun(postRunId);
    const postItems = await (await fetch(
      `https://api.apify.com/v2/datasets/${postDsId}/items?token=${APIFYTOKEN}&limit=1`
    )).json();

    if (postItems?.length > 0) {
      renderInstaHero(postItems[0]);
    } else {
      document.getElementById('postHeroLoading').style.display = 'none';
    }

    // ── Step 2: Fetch comments via original APIFYACTOR ──
    setStatus('💬 Fetching comments...', true);
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFYACTOR}/runs?token=${APIFYTOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [postUrl],
          resultsLimit: maxComments,
          includeNestedComments: inclReplies,
        })
      }
    );
    if (!runRes.ok) { const e = await runRes.json(); throw new Error(e.error?.message || `HTTP ${runRes.status}`); }
    const data = await runRes.json();
    const { id: runId, defaultDatasetId: dsId } = data;

    let status = 'RUNNING', attempts = 0;
    while (['RUNNING','READY'].includes(status) && attempts < 60) {
      await sleep(4000); attempts++;
      const s = await (await fetch(`https://api.apify.com/v2/acts/${APIFYACTOR}/runs/${runId}?token=${APIFYTOKEN}`)).json();
      status = s.data.status;
      setStatus(`Status: ${status} ${attempts * 4}s...`, true);
      if (status !== 'SUCCEEDED') throw new Error(`Run ended: ${status}`);
    }

    setStatus('Loading comments...', true);
    const rawComments = await (await fetch(
      `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFYTOKEN}&limit=${maxComments}`
    )).json();

    if (!rawComments?.length) return setStatus('No comments found or post is private.');

    // Build payload (same as before)
    const postId = postUrl.match(/\/p\/([^/?]+)/)?.[1] || 'unknown';
    const jsonPayload = {
      meta: {
        platform: 'instagram', source: 'Apify', actorId: APIFYACTOR,
        runId, datasetId: dsId, postUrl, postId,
        fetchedAt: new Date().toISOString(),
        totalFetched: rawComments.length,
      },
      postDetails: postItems?.[0] || null,
      summary: {
        totalComments: rawComments.length,
        totalLikes: rawComments.reduce((a,c) => a + (c.likesCount||0), 0),
        totalReplies: rawComments.reduce((a,c) => a + (c.repliesCount||0), 0),
        uniqueUsers: [...new Set(rawComments.map(c => c.ownerUsername).filter(Boolean))].length,
      },
      comments: rawComments.map(c => ({
        id: c.id||null, text: c.text||null, timestamp: c.timestamp||null,
        ownerUsername: c.ownerUsername||null, ownerFullName: c.ownerFullName||null,
        ownerProfilePicUrl: c.ownerProfilePicUrl||null,
        ownerIsVerified: c.ownerIsVerified??null,
        likesCount: c.likesCount??0, repliesCount: c.repliesCount??0,
        replies: (c.replies||[]).map(r => ({
          id: r.id||null, text: r.text||null, timestamp: r.timestamp||null,
          ownerUsername: r.ownerUsername||null, likesCount: r.likesCount??0,
        }))
      }))
    };

    const ts = new Date().toISOString().slice(0,19).replace(/\D/g,'-');
    saveJSON(jsonPayload, `instagram-comments-${postId}-${ts}.json`);
    setStatus('');

    const { totalComments, totalLikes, totalReplies, uniqueUsers } = jsonPayload.summary;
    document.getElementById('results').innerHTML = `
      <div class="stats-bar">
        <span><strong>Instagram</strong></span>
        <span><strong>${totalComments}</strong> comments</span>
        <span><strong>${totalLikes}</strong> likes</span>
        <span><strong>${totalReplies}</strong> replies</span>
        <span><strong>${uniqueUsers}</strong> users</span>
        <button class="toggle-comments-btn" onclick="toggleComments(this)">Show Comments</button>
      </div>
      <div id="commentsContainer">${rawComments.map(c => buildInstaCard(c, false)).join('')}</div>`;

    runAITasks(jsonPayload, 'insta');

  } catch(err) {
    document.getElementById('results').innerHTML =
      `<div class="error-box"><strong>Error</strong> ${err.message}</div>`;
    setStatus('');
    document.getElementById('postHeroLoading').style.display = 'none';
  } finally {
    btn.disabled = false;
  }
}

// ══ FETCH YOUTUBE (UPDATED) ══
async function fetchYouTube() {
  const rawInput = document.getElementById('urlInput').value.trim();
  const maxResults = parseInt(document.getElementById('maxComments').value) || 50;
  const inclReplies = document.getElementById('includeReplies').value === 'true';
  const order = document.getElementById('ytSort').value;
  const lang = document.getElementById('ytLang').value.trim();
  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;

  const videoId = extractYouTubeId(rawInput);
  if (!videoId) { setStatus('Could not extract YouTube Video ID.'); btn.disabled = false; return; }

  // Show hero loading
  document.getElementById('postHeroSection').style.display = 'block';
  document.getElementById('postHeroLoading').style.display = 'flex';
  document.getElementById('postHeroLoading').classList.remove('insta-loading');
  document.getElementById('postHeroLoadingText').textContent = '▶ Fetching YouTube video details...';
  document.getElementById('ytHero').style.display = 'none';
  document.getElementById('instaHero').style.display = 'none';

  try {
    // ── Step 1: Fetch post details via streamers/youtube-scraper ──
    setStatus('🚀 Starting streamers/youtube-scraper...', true);
    const ytScraperRes = await fetch(
      `https://api.apify.com/v2/acts/streamers~youtube-scraper/runs?token=${APIFYTOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: `https://www.youtube.com/watch?v=${videoId}` }],
          maxVideos: 1,
        })
      }
    );
    if (!ytScraperRes.ok) throw new Error(`YT scraper failed: ${ytScraperRes.status}`);
    const ytRunData = await ytScraperRes.json();
    const ytRunId = ytRunData.data.id;

    // Poll for video details (run in parallel with comments fetch)
    const ytDetailsPromise = waitApifyRun(ytRunId).then(dsId =>
      fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFYTOKEN}&limit=1`)
        .then(r => r.json())
    ).catch(() => null);

    // ── Step 2: Fetch comments via YouTube Data API v3 (in parallel) ──
    setStatus('💬 Fetching comments via YouTube API...', true);
    let allThreads = [], pageToken, totalApiCalls = 0;
    while (allThreads.length < maxResults) {
      const part = inclReplies ? 'snippet,replies' : 'snippet';
      let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=${part}&videoId=${videoId}&maxResults=${Math.min(maxResults,100)}&order=${order}&key=${YOUTUBEKEY}`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      if (lang) url += `&relevanceLanguage=${lang}`;
      const res = await fetch(url);
      const d = await res.json(); totalApiCalls++;
      if (!res.ok) throw new Error(d.error?.message || `HTTP ${res.status}`);
      allThreads = allThreads.concat(d.items);
      pageToken = d.nextPageToken;
      setStatus(`Fetched ${allThreads.length} comments...`, true);
      if (!pageToken || allThreads.length >= maxResults) break;
    }
    allThreads = allThreads.slice(0, maxResults);
    if (!allThreads.length) { setStatus('No comments found.'); return; }

    // ── Wait for scraper results & render hero ──
    setStatus('🎨 Loading video details...', true);
    const ytItems = await ytDetailsPromise;
    const scraperData = ytItems?.[0] || null;

    // Also fetch video metadata from YouTube API as fallback
    let videoMeta = {};
    try {
      const vd = await (await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YOUTUBEKEY}`
      )).json();
      if (vd.items?.[0]) videoMeta = vd.items[0];
    } catch(e) {}

    // Merge scraper data with API data
    const mergedMeta = {
      videoInfo: {
        title: scraperData?.title || videoMeta.snippet?.title || 'YouTube Video',
        description: scraperData?.description || videoMeta.snippet?.description || '',
        channelTitle: scraperData?.channelName || videoMeta.snippet?.channelTitle || '',
        channelId: scraperData?.channelId || videoMeta.snippet?.channelId || '',
        publishedAt: scraperData?.date || videoMeta.snippet?.publishedAt || '',
        tags: scraperData?.hashtags || videoMeta.snippet?.tags || [],
        thumbnails: {
          maxres: { url: scraperData?.thumbnailUrl || '' },
          high: { url: videoMeta.snippet?.thumbnails?.high?.url || '' },
          medium: { url: videoMeta.snippet?.thumbnails?.medium?.url || '' },
        },
        viewCount: scraperData?.viewCount || videoMeta.statistics?.viewCount || 0,
        likeCount: scraperData?.likes || videoMeta.statistics?.likeCount || 0,
        commentCount: scraperData?.numberOfComments || videoMeta.statistics?.commentCount || 0,
        duration: scraperData?.duration || videoMeta.contentDetails?.duration || '',
      }
    };

    renderYTHero(mergedMeta, videoId);

    // Build final payload
    const jsonPayload = {
      meta: {
        platform: 'youtube', source: 'YouTube Data API v3 + streamers/youtube-scraper',
        videoId, videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        fetchedAt: new Date().toISOString(), totalFetched: allThreads.length,
        includeReplies: inclReplies, sortOrder: order, languageFilter: lang || null,
        requestedMax: maxResults, apiCallsMade: totalApiCalls + 1,
      },
      postDetails: scraperData,
      videoInfo: mergedMeta.videoInfo,
      summary: {
        totalThreadsFetched: allThreads.length,
        totalTopLevelLikes: allThreads.reduce((a,t) => a + (t.snippet?.topLevelComment?.snippet?.likeCount||0), 0),
        totalReplies: allThreads.reduce((a,t) => a + (t.snippet?.totalReplyCount||0), 0),
        uniqueAuthors: [...new Set(allThreads.map(t => t.snippet?.topLevelComment?.snippet?.authorChannelId?.value).filter(Boolean))].length,
      },
      commentThreads: allThreads.map(thread => {
        const top = thread.snippet?.topLevelComment?.snippet;
        return {
          threadId: thread.id || null,
          canReply: thread.snippet?.canReply ?? null,
          totalReplyCount: thread.snippet?.totalReplyCount ?? 0,
          topLevelComment: {
            commentId: thread.snippet?.topLevelComment?.id || null,
            text: top?.textDisplay || null,
            authorDisplayName: top?.authorDisplayName || null,
            authorProfileImageUrl: top?.authorProfileImageUrl || null,
            likeCount: top?.likeCount ?? 0,
            publishedAt: top?.publishedAt || null,
            updatedAt: top?.updatedAt || null,
          },
          replies: (thread.replies?.comments || []).map(r => ({
            commentId: r.id || null,
            text: r.snippet?.textDisplay || null,
            authorDisplayName: r.snippet?.authorDisplayName || null,
            authorProfileImageUrl: r.snippet?.authorProfileImageUrl || null,
            likeCount: r.snippet?.likeCount ?? 0,
            publishedAt: r.snippet?.publishedAt || null,
          }))
        };
      })
    };

    const shortTitle = mergedMeta.videoInfo.title || videoId;
    const ts = new Date().toISOString().slice(0,19).replace(/\D/g,'-');
    saveJSON(jsonPayload, `youtube-comments-${slugify(shortTitle)}-${ts}.json`);
    setStatus('');

    const { totalThreadsFetched, totalTopLevelLikes, totalReplies, uniqueAuthors } = jsonPayload.summary;
    document.getElementById('results').innerHTML = `
      <div class="stats-bar yt">
        <span><strong>${shortTitle.slice(0,36)}</strong></span>
        <span><strong>${totalThreadsFetched}</strong> comments</span>
        <span><strong>${totalTopLevelLikes}</strong> likes</span>
        <span><strong>${totalReplies}</strong> replies</span>
        <span><strong>${uniqueAuthors}</strong> authors</span>
        <button class="toggle-comments-btn" onclick="toggleComments(this)">Show Comments</button>
      </div>
      <div id="commentsContainer">${allThreads.map(t => buildYTCard(t, inclReplies)).join('')}</div>`;

    runAITasks(jsonPayload, 'yt');

  } catch(err) {
    document.getElementById('results').innerHTML =
      `<div class="error-box"><strong>Error</strong> ${err.message}</div>`;
    setStatus('');
    document.getElementById('postHeroLoading').style.display = 'none';
  } finally {
    btn.disabled = false;
  }
}

  // ══ BUILD CARDS ══
  function toggleComments(btn){
    const c=document.getElementById("commentsContainer");
    const show=c.style.display==="none"||!c.style.display;
    c.style.display=show?"block":"none";
    btn.textContent=show?"🙈 Hide Comments":"👁 Show Comments";
  }

  function avatar(url,initial,cls){
    if(url){
      return `<img src="${url}" alt="pfp" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <div class="default-avatar ${cls}" style="display:none">${initial}</div>`;
    }
    return `<div class="default-avatar ${cls}">${initial}</div>`;
  }

  function buildInstaCard(c,isReply=false){
    const init=(c.ownerUsername||"U")[0].toUpperCase();
    const repliesHtml=(!isReply&&c.replies?.length)
      ? `<button class="toggle-replies" style="color:#833ab4" onclick="toggleReplies(this)">
           ▶ View ${c.replies.length} repl${c.replies.length>1?"ies":"y"}
         </button>
         <div class="replies-container" style="display:none">
           ${c.replies.map(r=>buildInstaCard(r,true)).join("")}
         </div>`
      : "";
    return `<div class="${isReply?"reply-card":"comment-card insta-card"}">
      <div class="comment-header">
        ${avatar(c.ownerProfilePicUrl,init,"insta-av")}
        <div>
          <div class="username">@${c.ownerUsername||"unknown"}${!isReply?'<span class="platform-badge b-insta">Instagram</span>':""}${c.ownerIsVerified?" ✔️":""}</div>
          <div class="meta">${formatDate(c.timestamp)}</div>
        </div>
      </div>
      <div class="comment-text">${c.text||""}</div>
      <div class="comment-footer">
        <span>❤️ ${c.likesCount||0}</span>
        ${!isReply?`<span>💬 ${c.repliesCount||0}</span>`:""}
      </div>
      ${repliesHtml}
    </div>`;
  }

  function buildYTCard(thread,inclReplies){
    const top=thread.snippet.topLevelComment.snippet;
    const rList=(inclReplies&&thread.replies?.comments)?thread.replies.comments:[];
    const init=(top.authorDisplayName||"U")[0].toUpperCase();
    const repliesHtml=rList.length
      ? `<button class="toggle-replies" style="color:#cc0000" onclick="toggleReplies(this)">
           ▶ View ${rList.length} repl${rList.length>1?"ies":"y"}
         </button>
         <div class="replies-container" style="display:none">
           ${rList.map(r=>buildYTReply(r)).join("")}
         </div>`
      : "";
    return `<div class="comment-card yt-card">
      <div class="comment-header">
        ${avatar(top.authorProfileImageUrl,init,"yt-av")}
        <div>
          <div class="username">${top.authorDisplayName||"Unknown"}<span class="platform-badge b-yt">YouTube</span></div>
          <div class="meta">
            ${formatDate(top.publishedAt)}
            ${top.updatedAt!==top.publishedAt?" · ✏️ Edited":""}
          </div>
        </div>
      </div>
      <div class="comment-text">${top.textDisplay||""}</div>
      <div class="comment-footer">
        <span>👍 ${top.likeCount||0}</span>
        <span>💬 ${thread.snippet.totalReplyCount||0} replies</span>
      </div>
      ${repliesHtml}
    </div>`;
  }

  function buildYTReply(r){
    const s=r.snippet;
    const init=(s.authorDisplayName||"U")[0].toUpperCase();
    return `<div class="reply-card">
      <div class="comment-header">
        ${avatar(s.authorProfileImageUrl,init,"yt-av")}
        <div>
          <div class="username" style="font-size:0.83rem">${s.authorDisplayName||"Unknown"}</div>
          <div class="meta">${formatDate(s.publishedAt)}</div>
        </div>
      </div>
      <div class="comment-text" style="font-size:0.86rem">${s.textDisplay||""}</div>
      <div class="comment-footer"><span>👍 ${s.likeCount||0}</span></div>
    </div>`;
  }

  function toggleReplies(btn){
    const c=btn.nextElementSibling;
    const show=c.style.display==="none"||!c.style.display;
    c.style.display=show?"block":"none";
    btn.textContent=show
      ? btn.textContent.replace("▶","▼").replace("View","Hide")
      : btn.textContent.replace("▼","▶").replace("Hide","View");
  }

  // ══ AI TASKS PIPELINE ══
  // ══════════════════════════════════════════════════════════
//  UNIFIED AI ANALYSIS — Single OpenRouter call for ALL sections
// ══════════════════════════════════════════════════════════
async function runAITasks(jsonPayload, platform) {
  const texts = getCommentTexts(jsonPayload, platform);
  const total = texts.length;

  if (platform === 'insta') {
    authorNames = jsonPayload.comments.map(c => c.ownerUsername);
  } else {
    authorNames = jsonPayload.commentThreads.map(t => t.topLevelComment?.authorDisplayName);
  }

  computeTopDiscussionThread(jsonPayload, platform);

  // Show all section skeletons immediately
  const sectionIds = [
    'sentimentSection','audienceSummarySection','topicSection',
    'profileSection','countrySection','hatePieSection',
    'spamSection','summarySection','personaSection','predictionSection'
  ];
  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  // Show all loading spinners
  ['sentimentLoading','audienceLoading','topicLoading','profileLoading',
   'countryLoading','spamLoading','summaryLoading','personaLoading','predictionLoading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; }
  });
  ['sentimentContent','audienceContent','topicContent','profileContent',
   'countryContent','spamContent','summaryContent','personaContent','predictionContent',
   'hatePieContent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  setTimeout(() => {
    document.getElementById('sentimentSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 400);

  initChat(jsonPayload, platform);

  // Prepare comment samples
  const sample200 = texts.slice(0, 200).map((t, i) => `${i+1}. ${t.slice(0, 150)}`).join('\n');
  const sample150 = texts.slice(0, 150).map((t, i) => `${i+1}. ${t.slice(0, 100)}`).join('\n');
  const platformLabel = platform === 'yt' ? 'YouTube' : 'Instagram';

  // Country hints (username + text)
  const combined = texts.map((t, i) => `user:${authorNames[i] || 'unknown'} ${t.slice(0, 200)}`);
  const countryHints = combined.slice(0, 200).map((t, i) => `${i+1}. ${t.slice(0, 200)}`).join('\n');

  // ── THE ONE BIG PROMPT ──
  const megaPrompt = `You are an expert social media analyst. Analyze these ${total} ${platformLabel} comments and return ALL sections in ONE JSON object.

COMMENTS:
${sample200}

Return ONLY this exact JSON structure (no markdown, no explanation):

{
  "sentiment": {
    "counts": {
      "Happy": 0, "Love": 0, "Excited": 0, "Angry": 0,
      "Sad": 0, "Toxic": 0, "Neutral": 0, "Sarcasm": 0
    },
    "overallMood": "Positive|Negative|Mixed|Neutral",
    "insight": "2-3 sentence summary of overall tone"
  },
  "audience": {
    "items": [
      {
        "rank": 1, "icon": "🔥", "category": "positive|negative|concern|suggestion|highlight|general",
        "title": "Short title max 6 words", "description": "1-2 sentences.",
        "commentCount": 42
      }
    ]
  },
  "topic": {
    "headline": "ONE punchy sentence under 30 words summarizing what viewers talk about",
    "description": "100-word paragraph describing emotional expression, tone, and what drives audience reaction",
    "tags": [
      { "label": "Topic Name", "count": 42 }
    ]
  },
  "profiles": {
    "profiles": [
      {
        "name": "Profile Name", "emoji": "🎯",
        "description": "Who they are in 1-2 sentences.",
        "opinions": ["Opinion 1", "Opinion 2", "Opinion 3"],
        "sharePercent": 35, "commentCount": 70
      }
    ]
  },
  "country": {
    "countries": {
      "India": { "pos": 0, "neg": 0, "neu": 0, "examples": ["example comment"] },
      "United States": { "pos": 0, "neg": 0, "neu": 0, "examples": ["example comment"] }
    },
    "unknownCount": 0,
    "notes": "1-2 sentence summary of geographic distribution"
  },
  "spam": {
    "spam":       { "count": 0, "pct": 0, "examples": ["example1"] },
    "bots":       { "count": 0, "pct": 0, "examples": ["bot1"] },
    "suspicious": { "count": 0, "pct": 0, "examples": ["sus1"] },
    "legit":      { "count": 0, "pct": 80 },
    "total": ${total},
    "riskLevel": "LOW|MEDIUM|HIGH",
    "recommendation": "1-sentence advice"
  },
  "summary": {
    "sentiment": "72% Positive",
    "topComplaint": "Audio quality",
    "topPraise": "Editing",
    "emotion": "Excitement",
    "action": "Improve audio"
  },
  "personas": {
    "personas": [
      {
        "name": "Tech Enthusiast", "emoji": "💻",
        "share": 35, "age": "18-25",
        "interests": "AI, coding", "mood": "excited", "engagement": "high"
      }
    ]
  },
  "prediction": {
    "like": 78,
    "dislike": 22,
    "net": 56,
    "confidence": "HIGH"
  }
}

RULES:
- audience.items: exactly 10 items
- profiles.profiles: 4-6 profiles, sharePercent must total 100
- personas.personas: exactly 4, share must total 100
- topic.tags: 6-8 tags
- country: detect from language/slang/references, include all countries found
- Return ONLY valid JSON. No text before or after.
COUNTRY HINTS (username + comment):
${countryHints}`;

  setStatus('🧠 Running unified AI analysis...', true);

  try {
    const raw = await callAI(megaPrompt, 0.2);
    const result = parseJSON(raw);

    setStatus('✅ Analysis complete!', false);
    setTimeout(() => setStatus(''), 2000);

    // ── Render all sections ──
    if (result.sentiment)  renderSentimentChart(result.sentiment, total);
    if (result.audience)   renderAudienceSummary({ items: result.audience.items }, total);
    if (result.topic)      renderTopicSection(result.topic, total);
    if (result.profiles)   renderProfileInsights(result.profiles, total);
    if (result.country)    buildCountryMap(result.country, total);
    if (result.spam)       renderSpamPie(result.spam);
    if (result.summary)    renderSummaryCards(result.summary);
    if (result.personas)   renderPersonas(result.personas.personas);
    if (result.prediction) renderPrediction(result.prediction.like ?? 78, result.prediction.dislike ?? 22);

  } catch (err) {
    console.error('Unified AI failed:', err);
    setStatus(`❌ AI Error: ${err.message}`, false);

    // ── Graceful fallback: show error in each section ──
    const errHtml = (msg) => `<p style="color:#f87171;font-family:'Segoe UI',sans-serif;text-align:center;padding:20px;">${msg}</p>`;
    ['sentimentLoading','audienceLoading','topicLoading','profileLoading',
     'countryLoading','spamLoading','summaryLoading','personaLoading','predictionLoading']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errHtml(`⚠️ ${err.message}`);
      });
  }
}



  // ══ 7. SPAM/BOT ANALYSIS ════════════════
async function runSpamAnalysis(texts, total) {
  document.getElementById("spamSection").style.display = "block";
  document.getElementById("spamLoading").style.display = "flex";
  document.getElementById("spamContent").style.display = "none";
  
  try {
    const raw = await callAI(
      `Analyze these ${texts.length} comments for spam/bots. Look for: repetitive phrases, emoji spam, generic praise/criticism, new accounts, suspicious links, copy-paste patterns.\\n\\nSample comments:\\n${texts.slice(0,100).map((t,i)=>`${i+1}. ${t.slice(0,120)}`).join("\\n")}\\n\\nReturn ONLY valid JSON:\\n{
  "spam": {"count":45, "pct":12, "examples":["example1", "example2"]},
  "bots": {"count":23, "pct":6, "examples":["bot1", "bot2"]},
  "suspicious": {"count":8, "pct":2, "examples":["sus1"]},
  "legit": {"count":324, "pct":80},
  "total": ${total},
  "risk_level": "LOW|MEDIUM|HIGH",
  "recommendation": "1-sentence advice"
}`, 0.1
    );
    renderSpamPie(parseJSON(raw));
  } catch(err) {
    document.getElementById("spamLoading").innerHTML = `<p style="color:#dc2626">⚠️ ${err.message}</p>`;
  }
}

function renderSpamPie(data) {
  const total = data.total || 0;
  const slices = [
    {key:"legit", color:"#10b981", label:"✅ Legit", pct:data.legit?.pct||80},
    {key:"spam", color:"#ef4444", label:"🚫 Spam", pct:data.spam?.pct||12},
    {key:"bots", color:"#a78bfa", label:"🤖 Bots", pct:data.bots?.pct||6},
    {key:"suspicious", color:"#f59e0b", label:"⚠️ Suspicious", pct:data.suspicious?.pct||2}
  ].filter(s => s.pct > 0);

  const svg = document.getElementById("spamPieSVG");
  svg.innerHTML = "";
  let startAngle = -Math.PI/2;
  
  slices.forEach((slice, i) => {
    const angle = (slice.pct / 100) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const midAngle = startAngle + angle / 2;
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", describeArc(190,190,160, startAngle, endAngle));
    path.setAttribute("fill", slice.color);
    path.setAttribute("stroke", "#0a0a1a");
    path.setAttribute("stroke-width", "3");
    path.classList.add("pie-slice");
    svg.appendChild(path);
    
    startAngle = endAngle;
  });

  document.getElementById("spamStats").innerHTML = `
    <div class="spam-stat">
      <div class="spam-stat-num">${data.legit?.count || total}</div>
      <div class="spam-stat-label">Legit Users</div>
    </div>
    <div class="spam-stat">
      <div class="spam-stat-num">${data.spam?.count || 0}</div>
      <div class="spam-stat-label">Spam Detected</div>
    </div>
    <div class="spam-stat">
      <div class="spam-stat-num">${data.risk_level || "LOW"}</div>
      <div class="spam-stat-label">Risk Level</div>
    </div>`;

  document.getElementById("spamSubtitle").textContent = `${data.recommendation || "Low spam detected"}`;
  document.getElementById("spamFooter").innerHTML = `
    <div style="background:rgba(220,38,38,0.1);border-color:rgba(220,38,38,0.3);color:#dc2626;">
      🤖 Detected by OpenRouter AI
    </div>`;

  document.getElementById("spamLoading").style.display = "none";
  document.getElementById("spamContent").style.display = "flex";
}

function describeArc(x, y, radius, startAngle, endAngle) {
  const innerRadius = 70;
  const startX = x + radius * Math.cos(startAngle);
  const startY = y + radius * Math.sin(startAngle);
  const endX = x + radius * Math.cos(endAngle);
  const endY = y + radius * Math.sin(endAngle);
  const innerStartX = x + innerRadius * Math.cos(startAngle);
  const innerStartY = y + innerRadius * Math.sin(startAngle);
  const innerEndX = x + innerRadius * Math.cos(endAngle);
  const innerEndY = y + innerRadius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${innerStartX} ${innerStartY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
}

// ══ 8. ONE-WORD SUMMARY ════════════════
async function runOneWordSummary(texts, total, platform) {
  document.getElementById("summarySection").style.display = "block";
  document.getElementById("summaryLoading").style.display = "flex";
  
  try {
    const raw = await callAI(
      `From these ${texts.length} ${platform} comments, extract in ONE WORD each:\\n${texts.slice(0,150).map((t,i)=>`${i+1}. ${t.slice(0,100)}`).join("\\n")}\\n\\nONLY JSON: {"sentiment":"72% positive","topComplaint":"audio quality","topPraise":"editing","emotion":"excitement","action":"improve audio"}`, 0.05
    );
    renderSummaryCards(parseJSON(raw));
  } catch(err) {
    document.getElementById("summaryLoading").innerHTML = `<p style="color:#94a3b8">⚠️ ${err.message}</p>`;
  }
}

function renderSummaryCards(data) {
  const cards = [
    {icon:"😊", label:"Overall Sentiment", value:data.sentiment || "72% Positive"},
    {icon:"🚫", label:"Top Complaints", value:data.topComplaint || "Audio Quality"},
    {icon:"⭐", label:"Top Praise", value:data.topPraise || "Editing"},
    {icon:"🎭", label:"Dominant Emotion", value:data.emotion || "Excitement"},
    {icon:"💡", label:"Suggested Action", value:data.action || "Improve Audio"}
  ];
  
  document.getElementById("summaryContent").innerHTML = cards.map(c => `
    <div class="summary-card">
      <div class="summary-icon">${c.icon}</div>
      <div class="summary-label">${c.label}</div>
      <div class="summary-value">${c.value}</div>
    </div>
  `).join("");
  
  document.getElementById("summaryLoading").style.display = "none";
  document.getElementById("summaryContent").style.display = "grid";
}

// ══ 9. PERSONA BUILDER ════════════════
async function runPersonaBuilder(texts, total, platform) {
  document.getElementById("personaSection").style.display = "block";
  document.getElementById("personaLoading").style.display = "flex";
  
  try {
    const raw = await callAI(
      `Build 4 audience personas from these ${texts.length} ${platform} comments. **MANDATORY**: Each persona must have "share": percentage of total comments (must add up to ~100%).\\n\\nSample:\\n${texts.slice(0,150).map((t,i)=>`${i+1}. ${t.slice(0,100)}`).join("\\n")}\\n\\n**STRICT JSON FORMAT**:\\n{
  "personas": [
    {
      "name": "Tech Enthusiast",
      "emoji": "💻",
      "share": 35,
      "age": "18-25",
      "interests": "AI, coding", 
      "mood": "excited",
      "engagement": "high"
    }
  ]
}`, 0.1
    );
    const result = parseJSON(raw);
    renderPersonas(result.personas || []);
  } catch(err) {
    document.getElementById("personaLoading").innerHTML = `<p style="color:#94a3b8">⚠️ ${err.message}</p>`;
  }
}


function renderPersonas(personas) {
  // Ensure shares add up and normalize if needed
  let totalShare = personas.reduce((sum, p) => sum + (p.share || 0), 0);
  if (totalShare === 0) totalShare = 100;
  
  document.getElementById("personaContent").innerHTML = personas.slice(0,4).map((p, i) => {
    const normShare = Math.round(((p.share || 0) / totalShare) * 100);
    const colors = ['#a78bfa', '#34d399', '#f59e0b', '#06b6d4'];
    
    return `
      <div class="persona-card">
        <div class="persona-avatar" style="background:linear-gradient(135deg,${colors[i]},#ec4899); color:white;">${p.emoji || '👤'}</div>
        <div class="persona-title">${p.name || 'Viewer'}</div>
        <div class="persona-detail"><span>👶</span> ${p.age || "18-25"}</div>
        <div class="persona-detail"><span>🎯</span> ${p.interests || "AI, Coding"}</div>
        <div class="persona-detail"><span>😊</span> ${p.mood || "Excited"}</div>
        <div class="persona-detail"><span>📈</span> ${p.engagement || "High"}</div>
        <div class="persona-share-badge">
          📊 ${normShare}% of audience
          <span style="font-size:0.7rem; opacity:0.8;">(${p.share || 0} comments)</span>
        </div>
      </div>
    `;
  }).join("");
  
  document.getElementById("personaLoading").style.display = "none";
  document.getElementById("personaContent").style.display = "grid";
}


// ══ 10. PREDICTION BARS ═══════════════
// ══ 10. PREDICTION BARS (FIXED) ═══════════════
async function runPrediction(texts, total) {
  document.getElementById("predictionSection").style.display = "block";
  document.getElementById("predictionLoading").style.display = "flex";
  
  // Fallback data agar AI fail ho jaye
  const fallback = { like: 78, dislike: 22, net: 56 };
  
  try {
    const raw = await callAI(
      `SINGLE JSON OBJECT ONLY - NO OTHER TEXT:\\n` +
      `{"like":${Math.floor(Math.random()*30+60)}, "dislike":${Math.floor(Math.random()*15+10)}, "net":0, "confidence":"HIGH"}\\n\\n` +
      `Analyze ${texts.length} comments for future content prediction. like = % who would like similar videos. dislike = % who might dislike. net = like-dislike. Sample:\\n` +
      `${texts.slice(0,50).map((t,i)=>`${i+1}. ${t.slice(0,60)}`).join("\\n")}`,
      0.05  // Super low temp for strict JSON
    );
    
    const pred = parseJSON(raw);
    renderPrediction(
      pred.like !== undefined ? pred.like : fallback.like,
      pred.dislike !== undefined ? pred.dislike : fallback.dislike
    );
  } catch(err) {
    console.log("Prediction AI failed, using fallback:", err);
    renderPrediction(fallback.like, fallback.dislike);
  }
}


function renderPrediction(likePct, dislikePct) {
  const net = likePct - dislikePct;
  document.getElementById("predScore").textContent = net > 0 ? `+${net}%` : `${net}%`;
  document.getElementById("predScore").style.color = net > 0 ? "#10b981" : "#ef4444";
  
  document.getElementById("predBars").innerHTML = `
    <div class="pred-bar-group">
      <div class="pred-bar-label">👍 Audience Like Prediction</div>
      <div class="pred-bar-container">
        <div class="pred-bar-fill pred-like" style="width:${likePct}%" data-label="${likePct}%"></div>
      </div>
    </div>
    <div class="pred-bar-group">
      <div class="pred-bar-label">👎 Potential Dislike</div>
      <div class="pred-bar-container">
        <div class="pred-bar-fill pred-dislike" style="width:${dislikePct}%" data-label="${dislikePct}%"></div>
      </div>
    </div>
  `;
  
  document.getElementById("predictionLoading").style.display = "none";
  document.getElementById("predictionContent").style.display = "flex";
}