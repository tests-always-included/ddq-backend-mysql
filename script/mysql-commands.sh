#!/bin/bash

mysql -u root -e "CREATE DATABASE testQueue;"
mysql -u root -e "CREATE TABLE queue (hash CHAR(64), PRIMARY KEY(hash));" -D "testQueue"
mysql -u root -e "ALTER TABLE queue ADD COLUMN messageBase64 VARCHAR(120) NOT NULL;" -D "testQueue"
mysql -u root -e "ALTER TABLE queue ADD COLUMN requeued BOOLEAN DEFAULT FALSE;" -D "testQueue"
mysql -u root -e "ALTER TABLE queue ADD COLUMN heartbeatDate DATETIME;" -D "testQueue"
mysql -u root -e "ALTER TABLE queue ADD COLUMN owner VARCHAR(256);" -D "testQueue"
mysql -u root -e "ALTER TABLE queue ADD COLUMN (isProcessing BOOLEAN DEFAULT FALSE, INDEX isProcessing(isProcessing));" -D "testQueue"
mysql -u root -e "ALTER TABLE queue ADD COLUMN topics VARCHAR(256);" -D "testQueue"
