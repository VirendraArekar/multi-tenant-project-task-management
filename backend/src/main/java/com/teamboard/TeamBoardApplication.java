package com.teamboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TeamBoardApplication {

    public static void main(String[] args) {
        SpringApplication.run(TeamBoardApplication.class, args);
    }
}
