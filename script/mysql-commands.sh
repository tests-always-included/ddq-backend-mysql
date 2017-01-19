#!/usr/bin/env bash

mysql -uroot < "${0%/*}"/mysql-commands.sql

