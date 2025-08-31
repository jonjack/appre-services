# appreciata-services


## Problems

We are still having an issue when define-auth-challenge runs the final time because "email_verified": "false" even though it is "true" in Cognito.

Kiro added some more logging to define-auth-challenge to see which code branch we run through.

Next steps:-

1. Build lambdas
2. deploy cdk stack
3. run reg again


Also, we need to check how Kiro has defined the indexes on our DynamoDB table since we had put a lot of thought inot how that would work previously when loading the users payment page. We have not yet cross-checked how we intended that Table to be set up with how Kiro has defined it so far.