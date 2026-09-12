
export const seedDecks={
"Japanese::Travel Essentials":[
["こんにちは","konnichiwa","hello; good afternoon","こんにちは、元気ですか？","Hello, are you well?","travel"],
["ありがとう","arigatou","thank you","ありがとうございます。","Thank you very much.","travel"],
["すみません","sumimasen","excuse me; sorry","すみません、駅はどこですか？","Excuse me, where is the station?","travel"],
["お願いします","onegaishimasu","please","これをお願いします。","This one, please.","travel"],
["いくらですか？","ikura desu ka?","how much is it?","これはいくらですか？","How much is this?","travel"],
["トイレ","toire","bathroom; toilet","トイレはどこですか？","Where is the bathroom?","travel"],
["おいしい","oishii","delicious","このラーメンはおいしいです。","This ramen is delicious.","travel"],
["大丈夫です","daijoubu desu","it's okay; I'm fine","大丈夫です、ありがとうございます。","I'm fine, thank you.","travel"],
["駅","えき","station","駅はどこですか？","Where is the station?","travel"],
["右","みぎ","right","右に曲がってください。","Please turn right.","travel"],
["左","ひだり","left","左に曲がってください。","Please turn left.","travel"],
["これ","kore","this","これは何ですか？","What is this?","travel"]
],
"Japanese::JLPT N5":[
["人","ひと","person","あの人は先生です。","That person is a teacher.","n5"],
["水","みず","water","水をください。","Water, please.","n5"],
["食べる","たべる","to eat","ご飯を食べる。","Eat a meal.","n5"],
["見る","みる","to see; watch","映画を見る。","Watch a movie.","n5"],
["行く","いく","to go","日本へ行く。","Go to Japan.","n5"],
["大きい","おおきい","big","大きい犬です。","It is a big dog.","n5"],
["小さい","ちいさい","small","小さい猫です。","It is a small cat.","n5"],
["今日","きょう","today","今日は暑いです。","It is hot today.","n5"],
["明日","あした","tomorrow","明日行きます。","I will go tomorrow.","n5"],
["先生","せんせい","teacher","先生です。","I am a teacher.","n5"]
],
"Japanese::Hiragana":[
["あ","a","a","あいうえお","The vowel row.","kana"],["か","ka","ka","かきくけこ","The ka row.","kana"],["さ","sa","sa","さしすせそ","The sa row.","kana"],["た","ta","ta","たちつてと","The ta row.","kana"],["な","na","na","なにぬねの","The na row.","kana"],["は","ha","ha","はひふへほ","The ha row.","kana"],["ま","ma","ma","まみむめも","The ma row.","kana"],["や","ya","ya","やゆよ","The ya row.","kana"],["ら","ra","ra","らりるれろ","The ra row.","kana"],["わ","wa","wa","わを","The wa row.","kana"]
]};

export function makeNote(arr,deck){return {id:crypto.randomUUID(),deck,front:arr[0],reading:arr[1],meaning:arr[2],sentence:arr[3],translation:arr[4],tags:[arr[5]],createdAt:Date.now()};}
