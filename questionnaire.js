// Cognition.run External JS. 質問文・回答尺度・CEFR換算はこのファイルで管理します。
// 換算は研究上の属性ラベルであり、現在の能力の実測ではありません。詳細・出典は README.md。
(function install(root) {
  "use strict";
  const VERSION="2026-11-27-v2", MAPPING_VERSION="mext-2018-2026-v2";
  const levels=["A1","A2","B1","B2","C1","C2"];
  const choices=(labels)=>labels.map((text,i)=>({value:i+1,text}));
  const change=choices(["大幅に減少した","減少した","やや減少した","変化しなかった","やや増加した","増加した","大幅に増加した"]).concat({value:"na",text:"該当しない・判断できない"});
  const burden=choices(["全く負担を感じなかった","ほとんど負担を感じなかった","あまり負担を感じなかった","ある程度負担を感じた","やや大きな負担を感じた","大きな負担を感じた","非常に大きな負担を感じた"]).concat({value:"na",text:"該当しない・判断できない"});
  const experience=choices(["全くない","1～2回","3～5回","6～10回","11回以上"]).concat({value:"unknown",text:"覚えていない・回答しない"});
  const aItems=[
    ["a1_error_detection","文法・語彙・スペリング等の表層的な誤りを発見すること"],
    ["a2_content_structure","作文の内容・構成を評価すること"],
    ["a3_verification","指摘内容の正確性を確認すること"],
    ["a4_selection","指摘すべき問題点を選択すること"],
    ["a5_correction","適切な修正方法を考えること"],
    ["a6_composition","フィードバックを文章としてまとめること"],
    ["a7_overall","フィードバック作成全体"]
  ];
  const bItems=[
    ["b1_reading_ai","AIが生成したフィードバック案を読むこと"],
    ["b2_inappropriate_ai","AIによる不適切な提案に対処すること"],
    ["b3_prompting","AIへの質問や修正指示を考えること"]
  ];
  // MEXT 2018, with official updates for newer formats. Bounds are CEFR reporting limits.
  const eiken={grade1:[2304,3299],pre1:[1980,2599],grade2:[1728,2299],pre2plus:[1550,1949],pre2:[1400,1949],grade3:[1400,1699]};
  const cambridge={key:[100,150],preliminary:[120,170],first:[140,190],advanced:[160,210],proficiency:[180,230]};
  const gtecMax={core:840,basic:1080,advanced:1280,cbt:1400};
  const qualificationChoices=[
    {value:"eiken",text:"英検（実用英語技能検定）"},
    {value:"toefl_old",text:"TOEFL iBT（0～120点：旧尺度）"},
    {value:"toefl_new",text:"TOEFL iBT（1～6：新尺度）"},
    {value:"ielts",text:"IELTS（Overall）"},
    {value:"teap",text:"TEAP（4技能総合）"},
    {value:"teap_cbt",text:"TEAP CBT"},
    {value:"toeic",text:"TOEIC L&R / S&W"},
    {value:"gtec",text:"GTEC（4技能：Core / Basic / Advanced / CBT）"},
    {value:"cambridge",text:"ケンブリッジ英語検定"},
    {value:"other",text:"その他の英語資格・検定"}
  ];
  const visible=(v)=>"{qualification_types} contains '"+v+"'";
  const radio=(name,title,items)=>({type:"radiogroup",name,title,choices:items});
  const select=(name,title,items,kind)=>({type:"dropdown",name,title,choices:items,visibleIf:visible(kind)});
  const number=(name,title,min,max,step,kind)=>({type:"text",name,title,inputType:"number",min,max,step,visibleIf:visible(kind),validators:[{type:"numeric",minValue:min,maxValue:max}]});
  const range=(min,max,step)=>Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step);
  const surveyJson=()=>({
    title:"フィードバック作成に関するアンケート",
    description:"2つの課題でのご経験についてお答えください。回答は任意です。氏名、勤務先など、個人が特定される情報は入力しないでください。",
    showQuestionNumbers:"off",showCompletedPage:false,completeText:"回答を終了する",
    pagePrevText:"戻る",pageNextText:"次へ",showProgressBar:"top",clearInvisibleValues:"onHidden",
    pages:[
      {name:"a",title:"A. フィードバック作成に伴う負担の変化",description:"今回の教師単独条件と比較して、AI協働条件での以下の作業の負担はどのように変化しましたか。",elements:aItems.map(([n,t],i)=>radio(n,"A"+(i+1)+". "+t,change))},
      {name:"b",title:"B. AI協働特有の負担",description:"今回AIと協働してフィードバックを作成する際、以下の作業にどの程度の負担を感じましたか。行わなかった作業は「該当しない・判断できない」を選択してください。",elements:bItems.map(([n,t],i)=>radio(n,"B"+(i+1)+". "+t,burden))},
      {name:"c",title:"C. 自由記述（任意）",elements:[
        {type:"comment",name:"c1_reduced",title:"C1. AIを使用することで負担が軽減された作業があれば、その具体的な内容や理由を記述してください。",rows:4},
        {type:"comment",name:"c2_increased",title:"C2. AIを使用することで負担が増加した作業や、新たに生じた負担があれば、その具体的な内容や理由を記述してください。",rows:4}
      ]},
      {name:"d",title:"D. 参加者の基本情報",elements:[
        radio("d1_feedback_experience","D1. 今回の実験を除き、これまでに英語学習者の英作文に対するフィードバックを作成した経験はどの程度ありますか。（教育実習・教職課程の演習等を含む。回数は概算で構いません。）",experience),
        radio("d2_ai_experience","D2. 今回の実験を除き、これまでに英作文に対するフィードバックの作成に生成AIを使用した経験はどの程度ありますか。（回数は概算で構いません。）",experience),
        {type:"checkbox",name:"qualification_types",title:"D3. 保有している英語資格・検定試験をすべて選択してください。過去に取得した資格も含みます。",choices:qualificationChoices,showNoneItem:true,noneText:"保有していない",showSelectAllItem:false},
        select("eiken_grade","英検：入力する4技能総合CSEスコアに対応する受験級（合否不問）",[{value:"grade1",text:"1級"},{value:"pre1",text:"準1級"},{value:"grade2",text:"2級"},{value:"pre2plus",text:"準2級プラス"},{value:"pre2",text:"準2級"},{value:"grade3",text:"3級"},{value:"other",text:"4級・5級・不明"}],"eiken"),
        number("eiken_cse","英検：上記の受験級の4技能総合CSEスコア（不明の場合は空欄）",0,3400,1,"eiken"),
        number("toefl_old_score","TOEFL iBT：旧尺度の総合スコア（0～120点）",0,120,1,"toefl_old"),
        select("toefl_new_score","TOEFL iBT：新尺度の総合スコア（1～6）",range(1,6,0.5),"toefl_new"),
        select("ielts_score","IELTS：Overall Band Score（0～9）",range(0,9,0.5),"ielts"),
        number("teap_score","TEAP：4技能総合スコア（80～400）",80,400,1,"teap"),
        number("teap_cbt_score","TEAP CBT：総合スコア（0～800）",0,800,5,"teap_cbt"),
        number("toeic_lr_total","TOEIC L&R：合計スコア（10～990、分かる場合）",10,990,5,"toeic"),
        number("toeic_sw_total","TOEIC S&W：合計スコア（0～400、分かる場合）",0,400,10,"toeic"),
        select("gtec_type","GTEC：受験タイプ",[{value:"core",text:"Core"},{value:"basic",text:"Basic"},{value:"advanced",text:"Advanced"},{value:"cbt",text:"CBT"}],"gtec"),
        select("gtec_era","GTEC：受験時期",[{value:"old",text:"2023年3月以前"},{value:"new",text:"2023年4月以降"},{value:"unknown",text:"不明"}],"gtec"),
        number("gtec_score","GTEC：上記タイプの4技能総合スコア（0～1400）",0,1400,1,"gtec"),
        select("cambridge_type","ケンブリッジ英語検定：受験した試験",[{value:"key",text:"A2 Key (KET)"},{value:"preliminary",text:"B1 Preliminary (PET)"},{value:"first",text:"B2 First (FCE)"},{value:"advanced",text:"C1 Advanced (CAE)"},{value:"proficiency",text:"C2 Proficiency (CPE)"}],"cambridge"),
        number("cambridge_score","ケンブリッジ英語検定：Cambridge English Scale 総合スコア",0,230,1,"cambridge"),
        {type:"text",name:"other_qualification",title:"その他：試験名・取得級・スコア（分かる範囲で）",visibleIf:visible("other")}
      ]}
    ]
  });
  const numeric=(v,min,max,step)=>{if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max&&Math.abs((n-min)/step-Math.round((n-min)/step))<1e-7?n:null;};
  const cutoff=(n,thresholds,labels=levels)=>{if(n===null)return null;let out=null;thresholds.forEach((t,i)=>{if(n>=t)out=labels[i];});return out;};
  function mapQualifications(r) {
    const selected=Array.isArray(r.qualification_types)?r.qualification_types:[];
    const candidates=[];
    function add(source,level){if(level)candidates.push({source,level});}
    const bounded=(n,bounds,cuts,labels=levels)=>n===null||!bounds||n<bounds[0]?null:cutoff(Math.min(n,bounds[1]),cuts,labels);
    if(selected.includes("eiken"))add("eiken_cse",bounded(numeric(r.eiken_cse,0,3400,1),eiken[r.eiken_grade],[1400,1700,1950,2300,2600]));
    if(selected.includes("toefl_old"))add("toefl_old",cutoff(numeric(r.toefl_old_score,0,120,1),[42,72,95],["B1","B2","C1"]));
    if(selected.includes("toefl_new"))add("toefl_new",cutoff(numeric(r.toefl_new_score,1,6,0.5),[1,2,3,4,5,6]));
    if(selected.includes("ielts"))add("ielts",cutoff(numeric(r.ielts_score,0,9,0.5),[4,5.5,7,8.5],["B1","B2","C1","C2"]));
    if(selected.includes("teap"))add("teap",cutoff(numeric(r.teap_score,80,400,1),[135,225,309,375],["A2","B1","B2","C1"]));
    if(selected.includes("teap_cbt"))add("teap_cbt",cutoff(numeric(r.teap_cbt_score,0,800,5),[235,420,600,800],["A2","B1","B2","C1"]));
    let toeicCombined=null;
    if(selected.includes("toeic")){
      const lr=numeric(r.toeic_lr_total,10,990,5),sw=numeric(r.toeic_sw_total,0,400,10);
      if(lr!==null&&sw!==null){
        toeicCombined=lr+2.5*sw;
        add("toeic_mext_combined",cutoff(toeicCombined,[320,625,1150,1560,1845]));
      }
    }
    if(selected.includes("cambridge"))add("cambridge",bounded(numeric(r.cambridge_score,0,230,1),cambridge[r.cambridge_type],[100,120,140,160,180,200]));
    if(selected.includes("gtec")&&Object.hasOwn(gtecMax,r.gtec_type)){
      const n=numeric(r.gtec_score,0,gtecMax[r.gtec_type],1);
      const old=cutoff(n,[270,690,960,1190,1350]);
      const current=cutoff(n,[260,680,930,1180,1350]);
      // If date is unknown, classify only when both versions agree.
      add("gtec",r.gtec_era==="old"?old:r.gtec_era==="new"?current:old===current?old:null);
    }
    const eligible=candidates;
    const rank=Math.max(-1,...eligible.map(c=>levels.indexOf(c.level)));
    const best=eligible.filter(c=>levels.indexOf(c.level)===rank);
    return {cefr_level:rank<0?"Unknown":levels[rank],cefr_sources:best.map(c=>c.source),cefr_candidates:candidates,toeic_combined_score:toeicCombined};
  }
  function buildTrial({surveyPlugin,getContext}){
    return {
      type:surveyPlugin,min_width:"0px",
      data:{feedback_phase:"workload_questionnaire",questionnaire_version:VERSION,cefr_mapping_version:MAPPING_VERSION},
      survey_json:surveyJson(),
      on_finish(data){
        const raw=data.response&&typeof data.response==="object"?data.response:{};
        Object.assign(data,getContext(),mapQualifications(raw));
        for(const [name] of [...aItems,...bItems]){
          const n=numeric(raw[name],1,7,1);
          data[name]=n;data[name+"_status"]=n!==null?"answered":raw[name]==="na"?"not_applicable":"unanswered";
          if(name.startsWith("a"))data[name+"_change"]=n===null?null:n-4;
        }
        for(const name of ["c1_reduced","c2_increased","d1_feedback_experience","d2_ai_experience"])data[name]=raw[name]??null;
        data.qualification_types=Array.isArray(raw.qualification_types)?raw.qualification_types:[];
        data.qualification_answers=Object.fromEntries(Object.entries(raw).filter(([k])=>k==="qualification_types"||/^(eiken_|toefl_|ielts_|teap_|toeic_|gtec_|cambridge_|other_qualification)/.test(k)));
        data.questionnaire_duration_ms=typeof data.rt==="number"?data.rt:null;
      }
    };
  }
  root.FB_QUESTIONNAIRE={version:VERSION,mappingVersion:MAPPING_VERSION,buildTrial,mapQualifications};
})(window);
