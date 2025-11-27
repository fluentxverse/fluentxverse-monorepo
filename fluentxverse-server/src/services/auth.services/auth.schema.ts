//** ELYSIA TYPE VALIDATION IMPORT
import { t } from "elysia";



// A minimal safe user shape returned to clients
export const UserSchema = t.Object({
    id: t.String(),
    email: t.String(),
    firstName: t.Optional(t.String()),
    lastName: t.Optional(t.String()),
    smartWalletAddress: t.Object({
        address: t.String(),
        createdAt: t.String(),
        label: t.String(),
        smartAccountAddress: t.String(),
    }),
    tier: t.Number()
});


export const RegisterSchema = {
    body: t.Object({
        email: t.String(),
        password: t.String(),
        firstName: t.String(),
        middleName: t.Optional(t.String()),
        lastName: t.String(),
        suffix: t.Optional(t.String()),
        birthDate: t.String(),
        mobileNumber: t.String(),
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String(),
            user: UserSchema
        })
    }
}




export const LoginSchema = {
    body: t.Object({
        email: t.String(),
        password: t.String(),
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            user: UserSchema
        })
    }
}

export const LogoutSchema = {
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String()
        })
    }
}

export const MeSchema = {
    response: {
        200: t.Object({
            user: t.Object({
                userId: t.String(),
                email: t.String(),
                firstName: t.Optional(t.String()),
                lastName: t.Optional(t.String()),
                walletAddress: t.Optional(t.String()),
                tier: t.Number()
            })
        })
    }
}