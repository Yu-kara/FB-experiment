// Cognition.run External JS. 質問文・回答尺度・CEFR換算はこのファイルで管理します。
// 換算は研究上の属性ラベルであり、現在の能力の実測ではありません。詳細・出典は README.md。
(function install(root) {
  "use strict";
  const VERSION="2026-11-26-v1", MAPPING_VERSION="2026-11-26-v1";
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
  const eiken={grade1:"C1",pre1:"B2",grade2:"B1",pre2plus:"A2",pre2:"A2",grade3:"A1"};
  const qualificationChoices=[
    {value:"eiken",text:"英検（実用英語技能検定）"},
    {value:"toefl_old",text:"TOEFL iBT（0～120点：旧尺度）"},
    {value:"toefl_new",text:"TOEFL iBT（1～6：新尺度）"},
    {value:"ielts",text:"IELTS（Overall）"},
    {value:"teap",text:"TEAP（4技能総合）"},
    {value:"teap_cbt",text:"TEAP CBT"},
    {value:"toeic",text:"TOEIC L&R / S&W"},
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
        radio("d1_feedback_experience","D1. これまでに英語学習者の英作文に対するフィードバックを作成した経験はどの程度ありますか。（教育実習・教職課程の演習等を含む。回数は概算で構いません。）",experience),
        radio("d2_ai_experience","D2. これまでに英作文に対するフィードバックの作成に生成AIを使用した経験はどの程度ありますか。（回数は概算で構いません。）",experience),
        {type:"checkbox",name:"qualification_types",title:"D3. 保有している英語資格・検定試験をすべて選択してください。過去に取得した資格も含みます。",choices:qualificationChoices,showNoneItem:true,noneText:"保有していない",showSelectAllItem:false},
        select("eiken_grade","英検：最も高い合格級",[{value:"grade1",text:"1級"},{value:"pre1",text:"準1級"},{value:"grade2",text:"2級"},{value:"pre2plus",text:"準2級プラス"},{value:"pre2",text:"準2級"},{value:"grade3",text:"3級"},{value:"other",text:"4級・5級・不明"}],"eiken"),
        number("toefl_old_score","TOEFL iBT：旧尺度の総合スコア（0～120点）",0,120,1,"toefl_old"),
        select("toefl_new_score","TOEFL iBT：新尺度の総合スコア（1～6）",range(1,6,0.5),"toefl_new"),
        select("ielts_score","IELTS：Overall Band Score（0～9）",range(0,9,0.5),"ielts"),
        number("teap_score","TEAP：4技能総合スコア（80～400）",80,400,1,"teap"),
        number("teap_cbt_score","TEAP CBT：総合スコア（0～800）",0,800,5,"teap_cbt"),
        number("toeic_lr_total","TOEIC L&R：合計スコア（10～990、分かる場合）",10,990,5,"toeic"),
        number("toeic_l","TOEIC Listening（5～495、分かる場合）",5,495,5,"toeic"),
        number("toeic_r","TOEIC Reading（5～495、分かる場合）",5,495,5,"toeic"),
        number("toeic_s","TOEIC Speaking（0～200、分かる場合）",0,200,10,"toeic"),
        number("toeic_w","TOEIC Writing（0～200、分かる場合）",0,200,10,"toeic"),
        {type:"text",name:"other_qualification",title:"その他：試験名・取得級・スコア（分かる範囲で）",visibleIf:visible("other")}
      ]}
    ]
  });
  const numeric=(v,min,max,step)=>{if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max&&Math.abs((n-min)/step-Math.round((n-min)/step))<1e-7?n:null;};
  const cutoff=(n,thresholds,labels=levels)=>{if(n===null)return null;let out=null;thresholds.forEach((t,i)=>{if(n>=t)out=labels[i];});return out;};
  function mapQualifications(r) {
    const selected=Array.isArray(r.qualification_types)?r.qualification_types:[];
    const candidates=[], details={};
    function add(source,level){if(level)candidates.push({source,level});}
    if(selected.includes("eiken"))add("eiken_grade",eiken[r.eiken_grade]||null);
    if(selected.includes("toefl_old"))add("toefl_old",cutoff(numeric(r.toefl_old_score,0,120,1),[42,72,95,114],["B1","B2","C1","C2"]));
    if(selected.includes("toefl_new"))add("toefl_new",cutoff(numeric(r.toefl_new_score,1,6,0.5),[1,2,3,4,5,6]));
    if(selected.includes("ielts"))add("ielts",cutoff(numeric(r.ielts_score,0,9,0.5),[4,5.5,7,8.5],["B1","B2","C1","C2"]));
    if(selected.includes("teap"))add("teap",cutoff(numeric(r.teap_score,80,400,1),[135,225,309,375],["A2","B1","B2","C1"]));
    if(selected.includes("teap_cbt"))add("teap_cbt",cutoff(numeric(r.teap_cbt_score,0,800,5),[235,420,600,800],["A2","B1","B2","C1"]));
    if(selected.includes("toeic")){
      const spec={l:[5,495,5,[60,110,275,400,490]],r:[5,495,5,[60,115,275,385,455]],s:[0,200,10,[50,90,120,160,180]],w:[0,200,10,[30,70,120,150,180]]};
      for(const [k,[min,max,step,cuts]] of Object.entries(spec))details[k]=cutoff(numeric(r["toeic_"+k],min,max,step),cuts);
      if(Object.values(details).every(Boolean))add("toeic_four_skill_min",levels[Math.min(...Object.values(details).map(x=>levels.indexOf(x)))]);
    }
    // Prefer an overall four-skill qualification; use TOEIC minimum only as a fallback.
    const overall=candidates.filter(c=>c.source!=="toeic_four_skill_min");
    const eligible=overall.length?overall:candidates;
    const rank=Math.max(-1,...eligible.map(c=>levels.indexOf(c.level)));
    const best=eligible.filter(c=>levels.indexOf(c.level)===rank);
    return {cefr_level:rank<0?"Unknown":levels[rank],cefr_sources:best.map(c=>c.source),cefr_candidates:candidates,toeic_skill_cefr:details};
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
        data.qualification_answers=Object.fromEntries(Object.entries(raw).filter(([k])=>k==="qualification_types"||/^(eiken_|toefl_|ielts_|teap_|toeic_|other_qualification)/.test(k)));
        data.questionnaire_duration_ms=typeof data.rt==="number"?data.rt:null;
      }
    };
  }
  root.FB_QUESTIONNAIRE={version:VERSION,mappingVersion:MAPPING_VERSION,buildTrial,mapQualifications};
})(window);
