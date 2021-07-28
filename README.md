# exam-env

pullre-kunを使った試験をするためのVPC/EC2インスタンス/ALB/ドメイン設定をするためのCDKプロジェクトです。  
env.json.sampleをenv.jsonとしてコピーし、適切な内容に変更して利用してください。  
（env.jsonは.gitignoreに指定されています）  

## 証明書の発行について

一度useCert=falseの状態で実行してRoute53のHostedZoneを作成してから、useCert=trueに変更してもう一度 cdk deploy --allを実行してください。  

## AWS料金について

無料枠ではおさらまない内容のため、このプロジェクトをデプロイすると課金が発生します。ご注意ください。  
（env.json.sampleの設定だとt4g.nanoインスタンスが2個、t4g.microインスタンスが2×3 = 6個、NATゲートウェイ、ロードバランサー1つが立ち上がります）  
