$endpoint = "http://host.docker.internal:8000"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Creating DynamoDB tables locally..." -ForegroundColor Cyan

# Table 1: Users
Write-Host "`nCreating Users table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --endpoint-url $endpoint `
    --table-name Users `
    --attribute-definitions `
        AttributeName=userId,AttributeType=S `
        AttributeName=city,AttributeType=S `
        AttributeName=state,AttributeType=S `
        AttributeName=totalPoints,AttributeType=N `
        AttributeName=leaderboardPartition,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --global-secondary-indexes file://$scriptDir/gsi/users-gsi.json `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Table 2: DumpPins
Write-Host "`nCreating DumpPins table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --endpoint-url $endpoint `
    --table-name DumpPins `
    --attribute-definitions `
        AttributeName=pinId,AttributeType=S `
        AttributeName=geohash,AttributeType=S `
        AttributeName=createdAt,AttributeType=S `
        AttributeName=city,AttributeType=S `
        AttributeName=status,AttributeType=S `
        AttributeName=state,AttributeType=S `
        AttributeName=reportedBy,AttributeType=S `
    --key-schema AttributeName=pinId,KeyType=HASH `
    --global-secondary-indexes file://$scriptDir/gsi/dumppins-gsi.json `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Table 3: Events
Write-Host "`nCreating Events table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --endpoint-url $endpoint `
    --table-name Events `
    --attribute-definitions `
        AttributeName=eventId,AttributeType=S `
        AttributeName=pinId,AttributeType=S `
        AttributeName=scheduledAt,AttributeType=S `
        AttributeName=city,AttributeType=S `
        AttributeName=state,AttributeType=S `
        AttributeName=organisedBy,AttributeType=S `
    --key-schema AttributeName=eventId,KeyType=HASH `
    --global-secondary-indexes file://$scriptDir/gsi/events-gsi.json `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Table 4: EventParticipants
Write-Host "`nCreating EventParticipants table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --endpoint-url $endpoint `
    --table-name EventParticipants `
    --attribute-definitions `
        AttributeName=eventId,AttributeType=S `
        AttributeName=userId,AttributeType=S `
        AttributeName=registeredAt,AttributeType=S `
    --key-schema AttributeName=eventId,KeyType=HASH AttributeName=userId,KeyType=RANGE `
    --global-secondary-indexes file://$scriptDir/gsi/eventparticipants-gsi.json `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Table 5: PointTransactions
Write-Host "`nCreating PointTransactions table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --endpoint-url $endpoint `
    --table-name PointTransactions `
    --attribute-definitions `
        AttributeName=userId,AttributeType=S `
        AttributeName=txnId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=txnId,KeyType=RANGE `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Table 6: Badges
Write-Host "`nCreating Badges table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --endpoint-url $endpoint `
    --table-name Badges `
    --attribute-definitions `
        AttributeName=userId,AttributeType=S `
        AttributeName=badgeId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=badgeId,KeyType=RANGE `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

Write-Host "`nAll tables created! Listing tables:" -ForegroundColor Green
aws dynamodb list-tables --endpoint-url $endpoint
