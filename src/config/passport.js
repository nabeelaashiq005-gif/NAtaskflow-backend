import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import { env } from "./env.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.googleClientId,
      clientSecret: env.googleClientSecret,
      callbackURL: env.googleCallbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0]?.value;
        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email: email,
            avatar: profile.photos[0]?.value || "",
            googleId: profile.id,
            isEmailVerified: true,
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
          user.isEmailVerified = true;
          if (!user.avatar && profile.photos[0]?.value) {
            user.avatar = profile.photos[0].value;
          }
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;