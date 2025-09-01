# appreciata-services


## Problems

- Registration now works and we have session management in DynamoDB
Next step is to sort out Login so it works like registration does.

- Also, we need to test session expiration - if we dont touch app for 20 mins the Session record should be evicted by Dynamo TTL.

- There is 1 record in session table from yesterday - check if it got eveicted.

- Also, look into logout which should explicitly remove session object.

- Also, we should get some common naming convention for all dynao tables - the session object is not prefixed with app name.

- Consider if we can shorten repo names (appreciata -> appre) and shorten app name in both apps.


- Also, we need to check how Kiro has defined the indexes on our DynamoDB table since we had put a lot of thought inot how that would work previously when loading the users payment page. We have not yet cross-checked how we intended that Table to be set up with how Kiro has defined it so far.